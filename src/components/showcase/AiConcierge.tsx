'use client'

import { useEffect, useRef, useState } from 'react'

const SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || ''

function toWsUrl(url: string) {
  if (!url) return ''
  return url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/transcripts'
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
}

const suggestedPrompts = [
  'What Twilio products power this demo?',
  "What's the AI-native maturity framework?",
  'Book me a move-in appointment tomorrow morning',
]

export function AiConcierge({ phoneNumber }: { phoneNumber?: string }) {
  const wsRef = useRef<WebSocket | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const emailRef = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [waitingForAgent, setWaitingForAgent] = useState(false)

  useEffect(() => {
    if (!emailRef.current) {
      emailRef.current = `guest-${Math.random().toString(36).slice(2, 9)}@cubesmart-demo.com`
    }
    if (!SERVER_URL) return
    const wsUrl = toWsUrl(SERVER_URL)
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'identify', userEmail: emailRef.current }))
    }
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'conversation_started' && data.conversation?.id) {
          conversationIdRef.current = data.conversation.id
        }
        if (data.type === 'transcript' && data.entry) {
          const entry = data.entry
          if (entry.role === 'tool') return
          if (entry.conversationId) conversationIdRef.current = entry.conversationId
          setMessages((prev) => [...prev, { id: entry.id, role: entry.role, text: entry.text }])
          if (entry.role === 'agent') setWaitingForAgent(false)
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, waitingForAgent])

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', text: trimmed }])
    wsRef.current.send(
      JSON.stringify({
        type: 'chat_message',
        text: trimmed,
        conversationId: conversationIdRef.current,
        userEmail: emailRef.current,
      })
    )
    setInput('')
    setWaitingForAgent(true)
  }

  if (!SERVER_URL) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full items-center justify-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-mint/15 text-mint self-center mb-3">
          AI Concierge
        </span>
        <p className="text-sm text-white/50">Deploy this app to activate the live AI Concierge — it runs on the voice/chat/SMS agent backend.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-mint/15 text-mint">
          AI Concierge · Autonomous Voice AI
        </span>
        <span className={`flex items-center gap-1.5 text-[11px] ${connected ? 'text-mint' : 'text-white/30'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-mint' : 'bg-white/30'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-starwhite">Chat with the AI Concierge</h3>
      <p className="mt-1.5 text-sm text-white/50">
        This is the same AI agent that answers CubeSmart tenants by voice, chat, and SMS.
        {phoneNumber && (
          <>
            {' '}
            Call it: <span className="text-starwhite font-semibold">{phoneNumber}</span>
          </>
        )}
      </p>

      <div ref={scrollRef} className="mt-4 flex-1 min-h-[220px] max-h-[320px] overflow-y-auto flex flex-col gap-2 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/60 hover:text-starwhite hover:border-mint/50 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-snug ${
                m.role === 'user' ? 'bg-neptune text-white rounded-tr-sm' : 'bg-white/10 text-starwhite rounded-tl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {waitingForAgent && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex gap-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/60" style={{ animationDelay: '0s' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/60" style={{ animationDelay: '0.2s' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/60" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage(input)
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? 'Ask about a unit, a lease, or Twilio…' : 'Connecting…'}
          disabled={!connected}
          className="flex-1 rounded-xl bg-deepspace border border-white/15 px-4 py-2.5 text-sm text-starwhite placeholder:text-white/30 focus:outline-none focus:border-mint disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !input.trim()}
          className="rounded-xl bg-neptune hover:bg-neptune-hover disabled:opacity-40 transition-colors text-white text-sm font-semibold px-4"
        >
          Send
        </button>
      </form>
    </div>
  )
}
