'use client'

import { useState } from 'react'
import { formatToE164 } from '@/lib/phone'
import type { CallStatus } from '@/hooks/use-webrtc'

const statusCopy: Record<string, string> = {
  idle: 'Ready to call',
  connecting: 'Calling…',
  ringing: 'Ringing…',
  'in-call': 'In call',
  disconnected: 'Call ended',
  error: 'Connection issue — try again',
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

function formatForDisplay(digits: string) {
  const d = digits.replace(/\D/g, '')
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
}

export function BrowserCallDemo({
  isReady,
  callStatus,
  onCall,
  onHangup,
  onSendDigit,
}: {
  isReady: boolean
  callStatus: CallStatus
  onCall: (to: string) => void
  onHangup: () => void
  onSendDigit: (digit: string) => void
}) {
  const [entered, setEntered] = useState('')
  const [activeLabel, setActiveLabel] = useState('')
  const inCall = callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'in-call'

  const placeCall = (rawNumber: string) => {
    const number = formatToE164(rawNumber)
    if (!number || number === '+') return
    setActiveLabel(formatForDisplay(number.replace(/^\+1/, '')))
    onCall(number)
    setEntered('')
  }

  const tapKey = (key: string) => {
    if (inCall) {
      onSendDigit(key)
      return
    }
    setEntered((prev) => (prev + key).slice(0, 15))
  }

  const displayText = inCall ? activeLabel || 'Calling…' : formatForDisplay(entered) || 'Enter a number'
  const subText = inCall ? statusCopy[callStatus] ?? 'In call' : entered ? ' ' : 'Ready to call'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-neptune/15 text-neptune-hover">
          Voice SDK · Client-Side Calling
        </span>
        <span className={`flex items-center gap-1.5 text-[11px] ${isReady ? 'text-mint' : 'text-white/30'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-mint' : 'bg-white/30'}`} />
          {isReady ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-starwhite">Call a lead</h3>
      <p className="mt-1.5 text-sm text-white/50">
        A desk phone embedded directly inside CubeSmart&apos;s staff tools using the Twilio
        Voice SDK — dial a real prospect and it actually rings.
      </p>

      <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center gap-4 mt-2">
        <div className="text-center min-h-[44px]">
          <p className="font-semibold text-starwhite text-lg">{displayText}</p>
          <p className="text-sm text-white/50 mt-0.5">{subText}</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => tapKey(k)}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-starwhite text-sm font-semibold transition-colors"
            >
              {k}
            </button>
          ))}
        </div>

        {inCall ? (
          <button
            onClick={onHangup}
            className="rounded-xl bg-barrys hover:bg-barrys-hover transition-colors text-white text-sm font-semibold px-6 py-3"
          >
            Hang Up
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEntered((prev) => prev.slice(0, -1))}
              disabled={!entered}
              className="text-white/40 hover:text-white/80 disabled:opacity-0 transition-colors text-sm px-2"
              aria-label="Backspace"
            >
              ⌫
            </button>
            <button
              onClick={() => placeCall(entered)}
              disabled={!isReady || !entered}
              className="rounded-xl bg-neptune hover:bg-neptune-hover disabled:opacity-40 transition-colors text-white text-sm font-semibold px-6 py-3"
            >
              Call
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
