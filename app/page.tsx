"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Sparkles, RotateCcw, MessageSquare } from "lucide-react"
import remarkGfm from "remark-gfm"
import ReactMarkdown from "react-markdown"
type Message = {
  role: "user" | "assistant"
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load previous conversation (if sessionId saved)
  useEffect(() => {
    const storedSession = localStorage.getItem("chat-session-id")
    if (!storedSession) return

    fetch(`/api/ai-agent?sessionId=${storedSession}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages)
          setSessionId(data.sessionId)
        }
      })
      .catch(() => {})
  }, [])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId,
        }),
      })

      // Save sessionId from response header
      const newSessionId = res.headers.get("X-Session-Id")
      if (newSessionId) {
        setSessionId(newSessionId)
        localStorage.setItem("chat-session-id", newSessionId)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      let aiText = ""

      // Add empty assistant message that will be filled
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        aiText += decoder.decode(value)

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: aiText },
        ])
      }
    } catch (error) {
      console.error("Error:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function startNewChat() {
    setMessages([])
    setSessionId(null)
    localStorage.removeItem("chat-session-id")
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen font-mono flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                TechGear Support
              </h1>
              <p className="text-xs text-slate-500">
                Friendly help, explained simply 🙂
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-200 hover:shadow-md"
            >
              <RotateCcw className="h-4 w-4" />
              New Chat
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.length === 0 && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <MessageSquare className="h-10 w-10 text-blue-600" />
              </div>
              <h2 className="mb-3 text-2xl font-bold text-slate-900">
                Welcome to TechGear Support!
              </h2>
              <p className="mb-8 max-w-md text-slate-600">
                I'm here to help answer your questions about our store, products,
                and policies. Ask me anything!
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  "What's your return policy?",
                  "Do you ship internationally?",
                  "What payment methods do you accept?",
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setInput(question)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              } animate-in fade-in slide-in-from-bottom-4 duration-500`}
            >
              <div
                className={`group relative max-w-[85%] rounded-2xl px-5 py-3 shadow-lg transition-all hover:shadow-xl ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                    : "bg-white text-slate-800 ring-1 ring-slate-200"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      AI Assistant
                    </span>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                  </ReactMarkdown>
                </p>

                {msg.role === "user" && (
                  <div className="absolute -right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    <span className="text-xs font-bold text-white">You</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex max-w-[85%] items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-lg ring-1 ring-slate-200">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage()
            }}
            className="relative"
          >
            <div className="relative flex items-center gap-2 rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about shipping, returns, or anything..."
                disabled={loading}
                maxLength={2000}
                className="flex-1 rounded-2xl bg-transparent px-5 py-4 text-[15px] text-slate-900 placeholder-slate-400 outline-none disabled:opacity-50"
              />

              {input.length > 1500 && (
                <span className="absolute right-20 top-1/2 -translate-y-1/2 text-xs text-orange-500">
                  {2000 - input.length} chars
                </span>
              )}

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="mr-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 hover:shadow-xl disabled:scale-100 disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>

          <p className="mt-3 text-center text-xs text-slate-400">
            Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5">Enter</kbd>{" "}
            to send • AI responses may contain errors
          </p>
        </div>
      </footer>
    </div>
  )
}