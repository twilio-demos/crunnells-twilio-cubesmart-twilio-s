'use client'

import type { JourneyState, ProfileSnapshot } from '@/lib/journey/types'

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - Date.parse(iso)
  if (Number.isNaN(diff)) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * The Memory store is shared with earlier demos, so it still holds trait groups
 * from those (Patient, Appointment). Only CubeSmart groups belong here.
 */
const VISIBLE_TRAIT_GROUPS = ['contact', 'membership']

function isVisibleGroup(group: string) {
  return VISIBLE_TRAIT_GROUPS.includes((group || '').trim().toLowerCase())
}

function Section({
  label,
  count,
  children,
}: {
  label: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {label}
        </h4>
        {typeof count === 'number' && (
          <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] text-white/50">
            {count}
          </span>
        )}
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>
      {children}
    </div>
  )
}

export function ProfilePane({
  state,
  profile,
}: {
  state: JourneyState | null
  profile: ProfileSnapshot | null
}) {
  if (!state) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/15 text-white/25">
          ?
        </div>
        <p className="text-[13px] font-medium text-white/60">No tenant profile yet</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/35">
          The Unified Profile fills in live as soon as he reserves a unit — traits, events and
          observations, straight from Twilio Memory.
        </p>
      </div>
    )
  }

  const traits = (profile?.traits ?? []).filter((trait) => isVisibleGroup(trait.group))
  const observations = profile?.observations ?? []
  const grouped = traits.reduce<Record<string, typeof traits>>((acc, trait) => {
    const key = trait.group || 'Other'
    acc[key] = acc[key] ? [...acc[key], trait] : [trait]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="rounded-2xl border border-emerald/20 bg-emerald-panel/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald text-sm font-semibold text-emerald-ink">
            {initials(state.firstName, state.lastName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold text-starwhite">
              {state.firstName} {state.lastName}
            </p>
            <p className="truncate text-[11px] text-white/50">
              {state.lookup?.nationalFormat || state.phone}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Unit type" value={state.membership.tier} />
          <Stat
            label="Access"
            value={state.membership.status === 'on-hold' ? 'Extended' : 'Standard'}
            tone={state.membership.status === 'on-hold' ? 'warn' : 'good'}
          />
          <Stat
            label="Autopay"
            value={state.membership.paymentStatus === 'expired' ? 'Card expired' : 'Current'}
            tone={state.membership.paymentStatus === 'expired' ? 'bad' : 'good'}
          />
          <Stat
            label="Units"
            value={String(state.classes.filter((c) => c.status !== 'cancelled').length)}
          />
        </div>

        {state.profileId && (
          <p className="mt-3 truncate font-mono text-[9px] text-white/25">{state.profileId}</p>
        )}
      </div>

      {/* Events */}
      <Section label="Events" count={state.events.length}>
        {state.events.length === 0 ? (
          <p className="text-[11px] text-white/35">Nothing fired yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...state.events].reverse().map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-emerald/20 bg-emerald/[0.07] px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold text-emerald-glow">
                    {event.name}
                  </span>
                  <span className="shrink-0 text-[9px] text-white/35">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
                {event.detail && (
                  <p className="mt-0.5 text-[11px] leading-snug text-white/55">{event.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Traits */}
      <Section label="Traits" count={traits.length}>
        {traits.length === 0 ? (
          <p className="text-[11px] text-white/35">Syncing from Memory…</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group}>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-emerald-glow/60">
                  {group}
                </p>
                <dl className="space-y-1">
                  {list.map((trait) => (
                    <div
                      key={`${group}-${trait.name}`}
                      className="flex items-baseline justify-between gap-3 rounded-md bg-white/[0.03] px-2.5 py-1.5"
                    >
                      <dt className="shrink-0 text-[11px] text-white/45">{trait.name}</dt>
                      <dd className="truncate text-right text-[11px] font-medium text-white/85">
                        {String(trait.value ?? '—')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Observations */}
      <Section label="Observations" count={observations.length}>
        {observations.length === 0 ? (
          <p className="text-[11px] text-white/35">No observations recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {observations.map((obs) => (
              <li
                key={obs.id || obs.content}
                className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-white/70"
              >
                {obs.content}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Reservation history */}
      <Section label="Reservation history" count={state.classes.length}>
        {state.classes.length === 0 ? (
          <p className="text-[11px] text-white/35">No reservations yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {state.classes.map((c) => (
              <li
                key={`${c.slotId}-${c.bookedAt}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-white/85">{c.className}</p>
                  <p className="truncate text-[10px] text-white/45">
                    {c.dayName}, {c.shortDate} · {c.timeLabel} · {c.instructor}
                  </p>
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    c.status === 'cancelled'
                      ? 'bg-white/10 text-white/40 line-through'
                      : c.status === 'attended'
                        ? 'bg-emerald/20 text-emerald-glow'
                        : 'bg-emerald/10 text-emerald-glow/80',
                  ].join(' ')}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'bad'
      ? 'text-red-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'good'
          ? 'text-emerald-glow'
          : 'text-white/85'
  return (
    <div className="rounded-lg bg-black/25 px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`truncate text-[11px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
