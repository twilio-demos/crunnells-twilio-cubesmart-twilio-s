'use client'

import { useMemo, useState } from 'react'
import { CubeSmartWordmark } from './EmeraldMark'
import type { ClassSlot, JourneyConfig, JourneyState } from '@/lib/journey/types'

interface BookingStageProps {
  config: JourneyConfig
  state: JourneyState | null
  /** Round 2 is pinned to Thursday so her "can't make Thursday" reply lands. */
  restrictToDate?: string
  busy: boolean
  onBook: (slotId: string) => void
}

export function BookingStage({
  config,
  state,
  restrictToDate,
  busy,
  onBook,
}: BookingStageProps) {
  const days = useMemo(() => {
    const source = restrictToDate
      ? config.schedule.filter((s) => s.dateISO === restrictToDate)
      : config.schedule
    const map = new Map<string, ClassSlot[]>()
    for (const slot of source) {
      map.set(slot.dateISO, [...(map.get(slot.dateISO) ?? []), slot])
    }
    return Array.from(map.entries()).slice(0, restrictToDate ? 1 : 8)
  }, [config.schedule, restrictToDate])

  const [activeDay, setActiveDay] = useState(days[0]?.[0] ?? '')
  const currentDay = days.find(([d]) => d === activeDay) ?? days[0]
  const slots = currentDay?.[1] ?? []
  const bookedIds = new Set(
    (state?.classes ?? []).filter((c) => c.status !== 'cancelled').map((c) => c.slotId)
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/40 px-5 py-3">
          <CubeSmartWordmark subtitle="Reserve a unit" />
          <span className="hidden rounded-full bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-white/40 sm:inline">
            cubesmart.com/reserve/west-7th
          </span>
        </div>

        {restrictToDate && (
          <div className="border-b border-emerald/20 bg-emerald/[0.06] px-5 py-2.5">
            <p className="text-[11px] text-emerald-glow">
              Maya is booking Thursday this time — that&apos;s the class she&apos;ll need to move
              in the next beat.
            </p>
          </div>
        )}

        {/* Day strip */}
        {!restrictToDate && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/[0.06] px-5 py-3 no-scrollbar">
            {days.map(([dateISO, list]) => {
              const first = list[0]
              const active = dateISO === activeDay
              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => setActiveDay(dateISO)}
                  className={[
                    'shrink-0 rounded-lg px-3 py-2 text-center transition',
                    active
                      ? 'bg-emerald text-emerald-ink'
                      : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08]',
                  ].join(' ')}
                >
                  <span className="block text-[9px] uppercase tracking-wider opacity-70">
                    {first.dayName.slice(0, 3)}
                  </span>
                  <span className="block text-[13px] font-semibold">{first.shortDate}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Slots */}
        <div className="divide-y divide-white/[0.05]">
          {slots.map((slot) => {
            const alreadyBooked = bookedIds.has(slot.id)
            return (
              <div
                key={slot.id}
                className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.02]"
              >
                <div className="w-[76px] shrink-0">
                  <p className="font-heading text-[15px] font-semibold text-starwhite">
                    {slot.timeLabel.replace(' ', '')}
                  </p>
                  <p className="text-[10px] text-white/40">{slot.duration} min</p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-starwhite">
                    {slot.className}
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    {slot.instructor} · {slot.room}
                  </p>
                </div>

                <div className="hidden w-20 shrink-0 text-right sm:block">
                  <p
                    className={[
                      'text-[11px] font-medium',
                      slot.spotsLeft <= 3 ? 'text-amber-300' : 'text-white/45',
                    ].join(' ')}
                  >
                    {slot.spotsLeft} units left
                  </p>
                </div>

                <button
                  type="button"
                  disabled={alreadyBooked || busy}
                  onClick={() => onBook(slot.id)}
                  className={[
                    'shrink-0 rounded-lg px-4 py-2 font-heading text-[12px] font-semibold transition',
                    alreadyBooked
                      ? 'bg-white/[0.06] text-white/35'
                      : 'bg-emerald text-emerald-ink hover:bg-emerald-glow disabled:opacity-50',
                  ].join(' ')}
                >
                  {alreadyBooked ? 'Booked' : busy ? '…' : 'Book'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="border-t border-white/[0.06] px-5 py-3">
          <p className="text-[10px] text-white/30">
            Every booking sends a real confirmation to her handset over RCS.
          </p>
        </div>
      </div>
    </div>
  )
}
