'use client'

import { useEffect, useRef } from 'react'
import { CubeSmartMark } from './EmeraldMark'
import type { JourneyMessage } from '@/lib/journey/types'

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function Chips({ buttons }: { buttons: { title: string; payload: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {buttons.map((b) => (
        <span
          key={b.payload}
          className="rounded-full border border-sky-400/60 bg-sky-400/10 px-2.5 py-1 text-[10px] font-medium text-sky-200"
        >
          {b.title}
        </span>
      ))}
    </div>
  )
}

function CarouselCards({ cards }: { cards: NonNullable<JourneyMessage['cards']> }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {cards.map((card, i) => (
        <div
          key={`${card.title}-${i}`}
          className="w-[150px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1b1c1e]"
        >
          {card.media && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.media}
              alt={card.title}
              className="h-[78px] w-full object-cover"
              crossOrigin="anonymous"
            />
          )}
          <div className="p-2">
            <p className="text-[11px] font-semibold leading-tight text-white">{card.title}</p>
            <p className="mt-1 line-clamp-3 text-[9px] leading-snug text-white/55">{card.body}</p>
            {card.buttons.map((b) => (
              <div
                key={b.payload}
                className="mt-2 rounded-full border border-sky-400/50 py-1 text-center text-[9px] font-medium text-sky-200"
              >
                {b.title}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DeliveryBadge({ message }: { message: JourneyMessage }) {
  // Until Twilio confirms, don't claim RCS — the whole point of this badge is
  // that a silent SMS fallback can no longer masquerade as a rich send.
  if (message.direction === 'outbound' && !message.channelConfirmed) {
    return (
      <span className="uppercase tracking-wider text-white/25">· sending…</span>
    )
  }

  if (message.fellBackToSms) {
    return (
      <span
        className="rounded-full bg-amber-400/15 px-1.5 py-px font-semibold uppercase tracking-wider text-amber-300"
        title={message.fallbackReason ?? 'Delivered over SMS instead of RCS.'}
      >
        ⚠ SMS fallback{message.errorCode ? ` · ${message.errorCode}` : ''}
      </span>
    )
  }

  if (message.channel === 'rcs') {
    return (
      <span className="rounded-full bg-sky-400/15 px-1.5 py-px font-semibold uppercase tracking-wider text-sky-300">
        RCS
      </span>
    )
  }

  return <span className="uppercase tracking-wider">· {message.channel}</span>
}

export function PhoneThread({
  messages,
  emptyHint,
}: {
  messages: JourneyMessage[]
  emptyHint?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const fallbacks = messages.filter((m) => m.fellBackToSms)

  return (
    <div className="mx-auto flex h-full w-full max-w-[330px] flex-col overflow-hidden rounded-[2.25rem] border-4 border-[#232323] bg-[#0d0d0f] shadow-2xl">
      {/* Chrome */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#121214] px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-white/40">‹</span>
          <div className="flex flex-1 items-center justify-center gap-2">
            <CubeSmartMark size={22} />
            <span className="text-[12px] font-semibold text-white">CubeSmart</span>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-sky-400" fill="currentColor">
              <path d="M12 2 14.4 4.3l3.2-.5.9 3.1 2.9 1.5-1.4 2.9 1.4 2.9-2.9 1.5-.9 3.1-3.2-.5L12 22l-2.4-2.3-3.2.5-.9-3.1L2.6 15.6 4 12.7 2.6 9.8l2.9-1.5.9-3.1 3.2.5z" />
              <path d="M10.6 15.2 7.8 12.4l1.1-1.1 1.7 1.7 4-4 1.1 1.1z" fill="#0d0d0f" />
            </svg>
          </div>
          <span className="w-3" />
        </div>
        <p className="mt-1 text-center text-[9px] uppercase tracking-[0.15em] text-white/30">
          Text Message · RCS
        </p>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 no-scrollbar">
        {messages.length === 0 && (
          <p className="mt-10 px-4 text-center text-[11px] leading-relaxed text-white/30">
            {emptyHint ?? 'Nothing sent yet.'}
          </p>
        )}

        {messages.map((message) => {
          const outbound = message.direction === 'outbound'
          return (
            <div
              key={message.id}
              className={outbound ? 'flex justify-start' : 'flex justify-end'}
            >
              <div className={outbound ? 'max-w-[86%]' : 'max-w-[78%]'}>
                <div
                  className={[
                    'rounded-2xl px-3 py-2',
                    outbound
                      ? message.kind === 'system'
                        ? 'border border-red-500/40 bg-red-500/10 text-red-200'
                        : 'bg-[#26282b] text-white'
                      : 'bg-sky-500 text-white',
                  ].join(' ')}
                >
                  {message.body && (
                    <p className="whitespace-pre-line text-[11.5px] leading-relaxed">
                      {message.body}
                    </p>
                  )}
                  {message.cards && message.cards.length > 0 && (
                    <div className={message.body ? 'mt-2' : ''}>
                      <CarouselCards cards={message.cards} />
                    </div>
                  )}
                  {message.buttons && message.buttons.length > 0 && (
                    <Chips buttons={message.buttons} />
                  )}
                </div>
                <p
                  className={[
                    'mt-1 flex items-center gap-1 text-[9px] text-white/30',
                    outbound ? '' : 'justify-end',
                  ].join(' ')}
                >
                  {clock(message.timestamp)}
                  <DeliveryBadge message={message} />
                </p>
                {message.fellBackToSms && message.fallbackReason && (
                  <p className="mt-1 max-w-[240px] text-[9px] leading-snug text-amber-300/70">
                    {message.fallbackReason}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2">
        {fallbacks.length > 0 ? (
          <p className="text-center text-[9px] leading-snug text-amber-300/80">
            {fallbacks.length} message{fallbacks.length === 1 ? '' : 's'} fell back to SMS —
            RCS did not render on this handset.
          </p>
        ) : (
          <p className="text-center text-[8px] text-white/20">
            Don&apos;t recognise this business? Report spam
          </p>
        )}
      </div>
    </div>
  )
}
