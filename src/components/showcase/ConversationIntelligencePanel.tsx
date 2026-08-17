'use client'

import { useEffect, useState } from 'react'
import type { CallStatus } from '@/hooks/use-webrtc'

type Sentiment = 'neutral' | 'positive' | 'negative' | 'mixed'

interface TranscriptLine {
  speaker: 'rep' | 'lead'
  text: string
}

type ScriptStep =
  | { atMs: number; type: 'line'; speaker: 'rep' | 'lead'; text: string }
  | { atMs: number; type: 'sentiment'; value: Sentiment }
  | { atMs: number; type: 'summary'; value: string }

const SCRIPT: ScriptStep[] = [
  { atMs: 300, type: 'line', speaker: 'rep', text: "Hi, this is Jordan from CubeSmart — I saw you requested pricing on a 10x10 climate-controlled unit. Is now an okay time?" },
  { atMs: 2400, type: 'line', speaker: 'lead', text: "Oh yeah, sure! I'm moving in a couple of weeks." },
  { atMs: 3200, type: 'sentiment', value: 'positive' },
  { atMs: 3600, type: 'summary', value: 'Prospect confirmed an upcoming move and interest in a 10x10 unit.' },
  { atMs: 5200, type: 'line', speaker: 'rep', text: "Great! We've got a move-in special this week — 50% off your first month. Would Tuesday or Thursday work better for your move-in appointment?" },
  { atMs: 8000, type: 'line', speaker: 'lead', text: 'Thursday could work, what time?' },
  { atMs: 8600, type: 'summary', value: 'Discussing the move-in special — narrowing down an appointment time.' },
  { atMs: 9800, type: 'line', speaker: 'rep', text: '3pm Thursday is open on the 10x10 in Building A. Want me to lock that in?' },
  { atMs: 12200, type: 'line', speaker: 'lead', text: "Yes, let's do it!" },
  { atMs: 12800, type: 'summary', value: 'Booked the 10x10 in Building A for Thursday 3pm under the move-in special.' },
]

const OPERATORS = [
  { name: 'Sentiment Analysis', kind: 'prebuilt' },
  { name: 'Summarization', kind: 'prebuilt' },
  { name: 'Outbound Call Disposition', kind: 'prebuilt' },
  { name: 'Voicemail Detection', kind: 'prebuilt' },
  { name: 'Lead Qualification Score', kind: 'custom' },
]

const sentimentStyle: Record<Sentiment, { label: string; className: string }> = {
  neutral: { label: 'Neutral', className: 'bg-white/10 text-white/60' },
  positive: { label: 'Positive', className: 'bg-mint/15 text-mint' },
  negative: { label: 'Negative', className: 'bg-barrys/20 text-barrys-hover' },
  mixed: { label: 'Mixed', className: 'bg-sunray/15 text-sunray' },
}

export function ConversationIntelligencePanel({ callStatus }: { callStatus: CallStatus }) {
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [sentiment, setSentiment] = useState<Sentiment>('neutral')
  const [summary, setSummary] = useState('')
  const [disposition, setDisposition] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)

  const listening = callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'in-call'
  const hasRun = lines.length > 0

  useEffect(() => {
    if (callStatus !== 'in-call') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines([])
    setSentiment('neutral')
    setSummary('')
    setDisposition(null)
    setSynced(false)

    const timers = SCRIPT.map((step) =>
      setTimeout(() => {
        if (step.type === 'line') setLines((prev) => [...prev, { speaker: step.speaker, text: step.text }])
        if (step.type === 'sentiment') setSentiment(step.value)
        if (step.type === 'summary') setSummary(step.value)
      }, step.atMs)
    )
    return () => timers.forEach(clearTimeout)
  }, [callStatus])

  useEffect(() => {
    if (callStatus !== 'disconnected' || !hasRun) return
    const t1 = setTimeout(() => setDisposition('Interested — Trial Class Booked'), 400)
    const t2 = setTimeout(() => setSynced(true), 1300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-mint/15 text-mint">
          Conversational Intelligence
        </span>
        <span className={`flex items-center gap-1.5 text-[11px] ${listening ? 'text-mint' : 'text-white/30'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${listening ? 'bg-mint animate-pulse' : 'bg-white/30'}`} />
          {listening ? 'Listening' : 'Idle'}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-starwhite">Live call intelligence</h3>
      <p className="mt-1.5 text-sm text-white/50">
        Language Operators run in real time on the call — transcript, sentiment, and summary build
        as it happens, then a disposition writes straight back to KORE.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {OPERATORS.map((op) => (
          <span
            key={op.name}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              listening ? 'border-mint/40 text-starwhite bg-mint/5' : 'border-white/15 text-white/40'
            }`}
          >
            <span className={`w-1 h-1 rounded-full ${listening ? 'bg-mint animate-pulse' : 'bg-white/30'}`} />
            {op.name}
            {op.kind === 'custom' && <span className="text-white/30">· custom</span>}
          </span>
        ))}
      </div>

      {!hasRun && !listening ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center text-center px-4">
          <p className="text-sm text-white/35">Place a call to see live sentiment, transcript, and an AI-generated summary appear here.</p>
        </div>
      ) : (
        <div className="mt-4 flex-1 min-h-[180px] flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-white/30">Sentiment</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentimentStyle[sentiment].className}`}>
              {sentimentStyle[sentiment].label}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
            {lines.map((l, i) => (
              <div key={i} className={`flex ${l.speaker === 'rep' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-snug ${
                    l.speaker === 'rep' ? 'bg-neptune/20 text-starwhite' : 'bg-white/10 text-starwhite'
                  }`}
                >
                  {l.text}
                </div>
              </div>
            ))}
          </div>

          {summary && (
            <div className="rounded-lg bg-deepspace border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1">Live summary</p>
              <p className="text-xs text-white/70 leading-relaxed">{summary}</p>
            </div>
          )}

          {disposition && (
            <div className="rounded-lg bg-mint/10 border border-mint/25 p-3">
              <p className="text-[10px] uppercase tracking-wide text-mint/70 mb-1">Call disposition</p>
              <p className="text-xs text-starwhite font-medium">{disposition}</p>
              {synced && (
                <p className="mt-1.5 text-[10px] text-mint flex items-center gap-1">
                  <span>✓</span> Synced to KORE — lead status &amp; move-in appointment updated
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-[10px] text-white/25">
        Simulated for this demo — shows what Twilio Conversational Intelligence surfaces in real
        time on a live call.
      </p>
    </div>
  )
}
