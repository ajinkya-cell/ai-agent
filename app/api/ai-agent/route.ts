// app/api/chat/route.ts

import { streamText } from "ai"
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
export const runtime = 'nodejs'

const openrouter = createOpenRouter({
    apiKey: process.env.OPEN_ROUTER_API_KEY
})

const adapter = new PrismaPg({
    connectionString : process.env.DATABASE_URL
})

const prisma = new PrismaClient({adapter})

const SYSTEM_PROMPT = `You are a professional, knowledgeable customer support assistant for TechGear Store, an e-commerce platform.

Your role:
- Provide accurate, concise, and helpful answers to customer questions
- Maintain a calm, professional, and respectful tone at all times
- Be clear, direct, and solution-oriented
- Answer whatever question is asked to you

Store Information:
- This is TechGear Store, an e-commerce platform
- Shipping: Worldwide (USA: 3-5 days, International: 7-14 days)
- Returns: 30-day policy, items must be unused
- Support Hours: Mon-Fri, 9 AM - 6 PM EST
- Payment: Visa, Mastercard, PayPal, Apple Pay

Answer support questions clearly and warmly.`

// Helper function to extract text from message content
function getMessageText(content: any): string {
    if (typeof content === 'string') {
        return content
    }
    if (Array.isArray(content)) {
        // Handle content parts array
        const textPart = content.find(part => part.type === 'text')
        return textPart?.text || ''
    }
    return ''
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { messages, sessionId } = body
        
        // Validation
        if (!messages || messages.length === 0) {
            return new Response("Messages cannot be empty", { status: 400 })
        }

        const lastMessage = messages[messages.length - 1]
        const messageContent = getMessageText(lastMessage.content)
        
        if (!messageContent || messageContent.trim().length === 0) {
            return new Response("Message content cannot be empty", { status: 400 })
        }

        // Truncate very long messages
        const sanitizedContent = messageContent.trim().slice(0, 2000)

        // Get or create conversation
        let conversationId = sessionId
        
        if (!conversationId) {
            const newConversation = await prisma.conversation.create({
                data: {},
            })
            conversationId = newConversation.id
        } else {
            // Verify conversation exists
            const existingConv = await prisma.conversation.findUnique({
                where: { id: conversationId },
            })
            
            if (!existingConv) {
                return new Response("Invalid session ID", { status: 404 })
            }
        }

        // Save user message to database
        await prisma.message.create({
            data: {
                conversationId,
                sender: 'user',
                text: sanitizedContent,
            },
        })

        // Get conversation history (last 20 messages for context)
        const previousMessages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { timestamp: 'asc' },
            take: 20,
        })

        // Convert DB messages to AI SDK format
        //@ts-ignore
        const contextMessages = previousMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.text,
        }))

        // Stream the AI response
        const result = streamText({
            model: openrouter.chat('x-ai/grok-4.1-fast'),
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                ...contextMessages
            ],
            // Callback when streaming completes
            onFinish: async ({ text }) => {
                try {
                    // Save AI response to database after streaming completes
                    await prisma.message.create({
                        data: {
                            conversationId,
                            sender: 'ai',
                            text: text,
                        },
                    })
                } catch (error) {
                    console.error("Error saving AI message to DB:", error)
                }
            }
        })

        // Convert to stream response and add sessionId header
        const response = result.toTextStreamResponse()
        
        // Add sessionId to response headers so frontend can access it
        response.headers.set('X-Session-Id', conversationId)

        return response

    } catch (error) {
        console.error("Error streaming chat completion:", error)
        return new Response("Failed to stream chat completion", { status: 500 })
    }
}

// GET endpoint to retrieve conversation history
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const sessionId = searchParams.get('sessionId')

        if (!sessionId) {
            return Response.json(
                { error: 'sessionId is required' },
                { status: 400 }
            )
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: sessionId },
            include: {
                messages: {
                    orderBy: { timestamp: 'asc' }
                }
            }
        })

        if (!conversation) {
            return Response.json(
                { error: 'Conversation not found' },
                { status: 404 }
            )
        }

        // Convert to format compatible with useChat hook
        //@ts-ignore
        const uiMessages = conversation.messages.map(msg => ({
            id: msg.id,
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
            createdAt: msg.timestamp,
        }))

        return Response.json({ 
            messages: uiMessages,
            sessionId: conversation.id 
        })

    } catch (error) {
        console.error("Error fetching conversation history:", error)
        return Response.json(
            { error: 'Failed to fetch conversation history' },
            { status: 500 }
        )
    }
}