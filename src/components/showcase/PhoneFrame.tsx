'use client'

import { useEffect, useState } from 'react'
import type { CapabilityMessage, CallScreen, RcsData } from '@/lib/data/capabilities'
import { CubeSmartLogoMark } from './BarrysLogoMark'

function CallScreenView({ accent, callScreen }: { accent: string; callScreen: CallScreen }) {
  return (
    <div className="h-full w-full bg-gradient-to-b from-[#1a1a1a] to-black flex flex-col items-center justify-between px-5 pt-16 pb-10 text-center">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-white/40">Incoming call</p>
        <div className="mt-5 flex justify-center">
          <CubeSmartLogoMark size={72} />
        </div>
        <p className="mt-4 text-lg font-semibold text-starwhite">{callScreen.callerName}</p>
        <p className="mt-1 text-xs text-white/60">{callScreen.reason}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-mint/40 text-mint">
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 10.5L9 12l3.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Verified caller ID
        </span>
      </div>

      <div className="w-full">
        <div className="rounded-xl bg-white/10 px-3 py-2.5 text-[10px] text-starwhite leading-snug mb-6">
          📈 {callScreen.insight}
        </div>
        <div className="flex justify-between items-center px-6">
          <div className="flex flex-col items-center gap-1.5">
            <span className="w-12 h-12 rounded-full bg-[#ff3b30] flex items-center justify-center text-white text-lg shadow-lg">✕</span>
            <span className="text-[9px] text-white/40">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg shadow-lg" style={{ background: accent }}>✓</span>
            <span className="text-[9px] text-white/40">Accept</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RcsView({ rcs }: { rcs: RcsData }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % rcs.cards.length), 2600)
    return () => clearInterval(t)
  }, [rcs.cards.length])

  const card = rcs.cards[index]

  return (
    <div className="h-full w-full bg-[#f5f5f5] flex flex-col text-center overflow-hidden">
      <div className="pt-7 px-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-ink">
          <span className="text-sm">‹</span>
          <span className="w-4 h-4 rounded-full bg-black text-white text-[8px] flex items-center justify-center">5</span>
        </div>
        <div className="flex flex-col items-center">
          <CubeSmartLogoMark size={34} />
          <span className="text-[11px] font-semibold text-ink mt-1">CubeSmart ›</span>
        </div>
        <span className="w-4" />
      </div>
      <p className="text-[9px] text-black/40 leading-tight">Text Message · RCS</p>
      <p className="text-[9px] text-black/40 mb-3">Today 11:46 AM</p>

      <div className="flex-1 px-3 overflow-hidden flex flex-col">
        <div className="bg-[#e9e9eb] text-ink text-[11px] rounded-2xl rounded-bl-sm px-3 py-2 self-start text-left leading-snug max-w-[85%]">
          {rcs.intro}
        </div>

        <div className="mt-2 text-[9px] text-black/40 text-left flex items-center gap-1">
          <span>🎟</span> {index + 1} of {rcs.cards.length}
        </div>

        <div className="relative mt-1">
          <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl bg-black/10" />
          <div className="relative rounded-xl bg-white overflow-hidden shadow-md text-left">
            <div className="relative w-full h-28 overflow-hidden bg-[#e9e9eb] flex items-center justify-center pt-2">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.photo}
                  alt={card.title}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <span
                className="absolute left-1/2 bottom-2 -translate-x-1/2 text-[9px] font-extrabold uppercase tracking-wider text-ink/50"
              >
                CUBESMART
              </span>
            </div>
            <div className="p-2.5">
              <p className="text-[11px] font-semibold text-ink leading-snug">{card.title}</p>
              <p className="text-[9px] text-black/40 mt-0.5 leading-snug">{card.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="mt-2 bg-[#e9e9eb] text-[#0a7cff] text-[11px] font-medium rounded-2xl rounded-bl-sm px-3 py-2 self-start text-left">
          {rcs.quickReply}
        </div>

        <div className="mt-auto pt-3 pb-2">
          <p className="text-[9px] text-black/40">Don&apos;t recognize this business?</p>
          <span className="inline-block mt-1 text-[9px] font-semibold text-[#0a7cff] bg-[#e4e9f5] px-2.5 py-1 rounded-full">
            Report Spam
          </span>
        </div>
      </div>

      <div className="border-t border-black/10 px-3 py-2 text-[10px] text-black/30 flex items-center justify-between">
        <span>+</span>
        <span>Text Message · RCS</span>
        <span>🎤</span>
      </div>
    </div>
  )
}

export function PhoneFrame({
  accent,
  messages,
  callScreen,
  rcs,
  children,
}: {
  accent: string
  messages?: CapabilityMessage[]
  callScreen?: CallScreen
  rcs?: RcsData
  children?: React.ReactNode
}) {
  return (
    <div className="relative w-[240px] h-[490px] rounded-[2.25rem] bg-ink border-[6px] border-black/40 shadow-2xl shadow-black/50 overflow-hidden shrink-0 mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />

      {callScreen ? (
        <CallScreenView accent={accent} callScreen={callScreen} />
      ) : rcs ? (
        <RcsView rcs={rcs} />
      ) : (
        <div className="h-full w-full bg-gradient-to-b from-deepspace-light to-deepspace flex flex-col">
          <div className="pt-7 px-4 pb-2 flex items-center gap-2 border-b border-white/10">
            <CubeSmartLogoMark size={22} />
            <span className="text-[11px] font-semibold text-starwhite">CubeSmart</span>
            <span className="ml-auto text-[8px] text-white/30">Powered by CubeSmart Management Platform</span>
          </div>
          <div className="flex-1 overflow-hidden px-3 py-3 flex flex-col gap-2">
            {messages
              ? messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.from === 'assistant' ? 'items-start' : 'items-end'}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-snug ${
                        m.from === 'assistant' ? 'bg-white/10 text-starwhite rounded-tl-sm' : 'text-deepspace rounded-tr-sm'
                      }`}
                      style={m.from === 'member' ? { background: accent } : undefined}
                    >
                      {m.text}
                    </div>
                    {m.chips && (
                      <div className="flex flex-wrap gap-1 mt-1 max-w-[85%]">
                        {m.chips.map((chip) => (
                          <span key={chip} className="text-[9px] px-2 py-1 rounded-full border border-white/20 text-white/70">
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              : children}
          </div>
        </div>
      )}
    </div>
  )
}
