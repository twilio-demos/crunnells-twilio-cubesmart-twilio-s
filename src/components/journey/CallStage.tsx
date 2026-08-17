'use client'

import { useEffect, useRef } from 'react'
import { CubeSmartMark } from './EmeraldMark'
import type { JourneyConfig, JourneyState } from '@/lib/journey/types'

function prettyPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

export function CallPromptStage({
  config,
  state,
  variant,
}: {
  config: JourneyConfig
  state: JourneyState | null
  variant: 'after-hours' | 'callback'
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="border-b border-white/[0.07] bg-black/40 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-glow">
              {variant === 'after-hours' ? 'After hours · 8:04 PM' : 'Sixty days later'}
            </span>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] text-white/40">
              Store closed
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 px-6 py-10 text-center">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-emerald/40 ring-pulse" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-panel ring-1 ring-emerald/50">
              <CubeSmartMark size={44} />
            </span>
          </div>

          <div>
            <p className="font-heading text-lg font-semibold text-starwhite">
              {variant === 'after-hours'
                ? 'Call the store from your phone'
                : 'Call back to sort out your account'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/55">
              {variant === 'after-hours'
                ? 'Nobody is at the store. The voice agent picks up, already knowing who is calling. Ask for a gate access code reset.'
                : 'Same number, same agent. It should greet you by name and tell you your gate access is already extended before you ask.'}
            </p>
          </div>

          <a
            href={`tel:${config.studioPhone}`}
            className="rounded-xl bg-emerald px-6 py-3.5 font-heading text-lg font-semibold tracking-wide text-emerald-ink transition hover:bg-emerald-glow"
          >
            {prettyPhone(config.studioPhone)}
          </a>

          {variant === 'callback' && state?.membership.holdEnd && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-4 py-2.5">
              <p className="text-[11px] text-amber-200">
                On file: extended access through {state.membership.holdEnd} · Visa ••••{' '}
                {state.membership.cardLast4} exp {state.membership.cardExpiry}
              </p>
            </div>
          )}

          <p className="text-[11px] text-white/30">
            {variant === 'after-hours'
              ? 'Try: “I got locked out at the gate and I need my access code reset for tonight.”'
              : 'Try: “Hi, can you help me sort out my autopay — I think my card expired.”'}
          </p>

          {variant === 'callback' && (
            <p className="mx-auto max-w-md text-[11px] leading-relaxed text-white/30">
              Then push a little: “Honestly, I found a cheaper unit down the street — I wasn’t sure
              this was worth it anymore.” Watch the retention risk score climb as you say it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function LiveCallStage({
  state,
  onForceHandoff,
  forcing,
}: {
  state: JourneyState | null
  onForceHandoff?: () => void
  forcing?: boolean
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lines = state?.transcript ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lines.length])

  const live = state?.callStatus === 'in-call'
  const canForce =
    Boolean(onForceHandoff) && live && !state?.transferring && !state?.flex?.transferred

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className={[
                'h-2 w-2 rounded-full',
                live ? 'bg-emerald animate-pulse' : 'bg-white/25',
              ].join(' ')}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              {live ? 'Call in progress' : state?.callStatus === 'ended' ? 'Call ended' : 'Waiting for the call'}
            </span>
          </div>
          <span className="text-[10px] text-white/35">
            Voice AI · {state?.firstName ?? 'tenant'} · call #{state?.callCount ?? 0}
          </span>
        </div>

        <div className="max-h-[52vh] min-h-[240px] space-y-3 overflow-y-auto px-5 py-5 no-scrollbar">
          {lines.length === 0 && (
            <p className="py-12 text-center text-[12px] text-white/30">
              The transcript streams in here as she speaks.
            </p>
          )}

          {lines.map((line) => {
            if (line.role === 'tool' || line.role === 'system') {
              return (
                <div
                  key={line.id}
                  className="rounded-lg border border-emerald/25 bg-emerald/[0.06] px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-glow">
                    {line.role === 'tool' ? 'Action taken' : 'System'}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/70">{line.text}</p>
                </div>
              )
            }
            const member = line.role === 'member'
            return (
              <div key={line.id} className={member ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={[
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                    member ? 'bg-white/[0.08] text-white' : 'bg-emerald/15 text-emerald-glow',
                  ].join(' ')}
                >
                  <p className="mb-0.5 text-[9px] uppercase tracking-[0.15em] opacity-55">
                    {member ? 'Maya' : 'CubeSmart'}
                  </p>
                  <p className="text-[12px] leading-relaxed">{line.text}</p>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {state?.membership.status === 'on-hold' && (
          <div className="border-t border-emerald/20 bg-emerald/[0.06] px-5 py-3">
            <p className="text-[11px] text-emerald-glow">
              Extended access on file: {state.membership.holdStart} → {state.membership.holdEnd} ·
              standard rent still applies
            </p>
          </div>
        )}

        {canForce && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-black/30 px-5 py-3">
            <p className="text-[10.5px] leading-relaxed text-white/40">
              If the agent stalls on the call, you can hand her to the desk yourself — the same real
              TaskRouter task, same context.
            </p>
            <button
              type="button"
              onClick={onForceHandoff}
              disabled={forcing}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/65 transition hover:bg-white/5 disabled:opacity-50"
            >
              {forcing ? 'Transferring…' : 'Hand off to Flex now'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
