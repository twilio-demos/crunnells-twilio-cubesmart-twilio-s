'use client'

import { useEffect, useRef } from 'react'
import type { JourneyBeat } from '@/lib/journey/types'

interface StoryRailProps {
  beats: JourneyBeat[]
  beatId: string
  completed: string[]
  firedEvents: string[]
  busy: string | null
  onAction: (beat: JourneyBeat) => void
}

type BeatStatus = 'done' | 'active' | 'locked'

function statusFor(beat: JourneyBeat, beatId: string, completed: string[]): BeatStatus {
  if (completed.includes(beat.id)) return 'done'
  if (beatId === beat.id) return 'active'
  return 'locked'
}

/** Which beats have an operator button, and what the button does. */
const ACTIONS: Record<string, string> = {
  setup: 'advance',
  welcome: 'send-welcome',
  reminder: 'send-reminder',
  fuel: 'send-fuel',
  'post-class': 'send-post-class',
  save: 'complete-save',
}

export function StoryRail({
  beats,
  beatId,
  completed,
  firedEvents,
  busy,
  onAction,
}: StoryRailProps) {
  const activeRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [beatId])

  const rows = beats.map((beat, index) => ({
    beat,
    showActHeader: index === 0 || beats[index - 1].actLabel !== beat.actLabel,
  }))

  return (
    <ol className="space-y-2">
      {rows.map(({ beat, showActHeader }) => {
        const status = statusFor(beat, beatId, completed)
        const hasButton = Boolean(ACTIONS[beat.id]) && status === 'active'
        const buttonBusy = busy === beat.id

        return (
          <li key={beat.id} ref={status === 'active' ? activeRef : undefined}>
            {showActHeader && (
              <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-glow">
                  {beat.actLabel}
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            )}

            <div
              className={[
                'rounded-xl border px-4 py-3 transition-all duration-300',
                status === 'active'
                  ? 'border-emerald/50 bg-emerald-panel/70 beat-pulse'
                  : status === 'done'
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-white/[0.06] bg-transparent opacity-45',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                    status === 'done'
                      ? 'border-emerald/60 bg-emerald/20 text-emerald-glow'
                      : status === 'active'
                        ? 'border-emerald bg-emerald text-emerald-ink'
                        : 'border-white/20 text-white/40',
                  ].join(' ')}
                >
                  {status === 'done' ? '✓' : beat.step}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3
                      className={[
                        'font-heading text-sm font-semibold',
                        status === 'locked' ? 'text-white/50' : 'text-starwhite',
                      ].join(' ')}
                    >
                      {beat.title}
                    </h3>
                    {status === 'locked' && (
                      <span className="text-[10px] text-white/30">locked</span>
                    )}
                  </div>

                  {status === 'active' && (
                    <div className="mt-2 space-y-3">
                      <p className="text-[13px] leading-relaxed text-white/80">
                        {beat.narration}
                      </p>
                      <p className="border-l-2 border-emerald/40 pl-3 text-[11px] leading-relaxed text-emerald-glow/75">
                        {beat.mechanic}
                      </p>

                      {beat.events && beat.events.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {beat.events.map((name) => {
                            const fired = firedEvents.includes(name)
                            return (
                              <span
                                key={name}
                                className={[
                                  'rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide',
                                  fired
                                    ? 'bg-emerald/20 text-emerald-glow ring-1 ring-emerald/40'
                                    : 'bg-white/5 text-white/40 ring-1 ring-white/10',
                                ].join(' ')}
                              >
                                {fired ? '● ' : '○ '}
                                {name}
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {beat.waiting && (
                        <div className="relative overflow-hidden rounded-lg border border-emerald/25 bg-emerald/5 px-3 py-2 waiting-sweep">
                          <p className="relative z-10 text-[11px] font-medium text-emerald-glow">
                            {beat.waiting}
                          </p>
                        </div>
                      )}

                      {hasButton && (
                        <button
                          type="button"
                          onClick={() => onAction(beat)}
                          disabled={buttonBusy}
                          className="w-full rounded-lg bg-emerald px-4 py-2.5 font-heading text-[13px] font-semibold text-emerald-ink transition hover:bg-emerald-glow disabled:opacity-60"
                        >
                          {buttonBusy ? 'Sending…' : beat.action}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { ACTIONS as BEAT_ACTIONS }
