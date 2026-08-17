'use client'

import type { JourneyIntel, RiskBand, SentimentLabel } from '@/lib/journey/types'

/**
 * Live Conversation Intelligence, as it happens on the call.
 *
 * Call reason, sentiment and retention risk are shown here. The recommended
 * save offer deliberately is not — that one goes to the human agent in Flex.
 */

const SENTIMENT: Record<SentimentLabel, { label: string; dot: string; text: string; bg: string }> = {
  positive: {
    label: 'Positive',
    dot: 'bg-emerald',
    text: 'text-emerald-glow',
    bg: 'bg-emerald/[0.09] border-emerald/25',
  },
  neutral: {
    label: 'Neutral',
    dot: 'bg-white/40',
    text: 'text-white/60',
    bg: 'bg-white/[0.04] border-white/10',
  },
  mixed: {
    label: 'Mixed',
    dot: 'bg-amber-400',
    text: 'text-amber-200',
    bg: 'bg-amber-400/[0.08] border-amber-400/25',
  },
  negative: {
    label: 'Negative',
    dot: 'bg-red-400',
    text: 'text-red-300',
    bg: 'bg-red-500/[0.09] border-red-500/25',
  },
}

const BAND: Record<RiskBand, { label: string; text: string; bar: string; ring: string }> = {
  low: { label: 'Low', text: 'text-emerald-glow', bar: 'bg-emerald', ring: 'border-emerald/25' },
  watch: { label: 'Watch', text: 'text-sky-300', bar: 'bg-sky-400', ring: 'border-sky-400/25' },
  elevated: {
    label: 'Elevated',
    text: 'text-amber-200',
    bar: 'bg-amber-400',
    ring: 'border-amber-400/30',
  },
  high: { label: 'High', text: 'text-red-300', bar: 'bg-red-400', ring: 'border-red-500/30' },
}

function timeOf(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function IntelligencePanel({
  intel,
  live,
  configured,
}: {
  intel?: JourneyIntel
  live: boolean
  configured: boolean
}) {
  const hasAnything = Boolean(intel && intel.totalRuns > 0)
  const lastRun = intel?.runs[0]

  return (
    <div className="mx-auto mt-5 w-full max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-black/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className={[
                'h-2 w-2 rounded-full',
                live && hasAnything ? 'bg-emerald animate-pulse' : 'bg-white/25',
              ].join(' ')}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Conversation Intelligence
            </span>
          </div>
          <span className="text-[10px] text-white/35">
            {hasAnything
              ? `${intel!.totalRuns} operator ${intel!.totalRuns === 1 ? 'run' : 'runs'} this call`
              : 'Language Operators standing by'}
          </span>
        </div>

        {!configured ? (
          <div className="px-5 py-6">
            <p className="text-[12px] text-white/40">
              The live operators are not wired up on this account yet, so nothing will appear here.
            </p>
          </div>
        ) : !hasAnything ? (
          <div className="px-5 py-6">
            <p className="text-[12px] leading-relaxed text-white/40">
              {live
                ? 'Listening. The first read lands a couple of seconds after she starts talking.'
                : 'Call reason, sentiment and retention risk appear here as she speaks — scored on the live transcript, not after the call.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            <ReasonRow intel={intel!} />
            <SentimentRow intel={intel!} />
            <RiskRow intel={intel!} />
          </div>
        )}

        {/* Live strip */}
        {hasAnything && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.07] bg-black/30 px-5 py-2.5">
            <span className="text-[10px] text-white/30">
              Last read <span className="text-white/50">{lastRun?.operator}</span>
              {lastRun?.latencyMs ? (
                <span className="text-white/50"> · {(lastRun.latencyMs / 1000).toFixed(1)}s</span>
              ) : null}
            </span>
            {lastRun?.model && (
              <span className="text-[10px] text-white/25">{lastRun.model}</span>
            )}
            <span className="ml-auto text-[10px] text-white/25">
              Save offer goes to the store team in Flex, not to her
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 py-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {label}
      </p>
      {children}
    </div>
  )
}

function ReasonRow({ intel }: { intel: JourneyIntel }) {
  const reason = intel.reason
  const resolved = reason && !/not clear/i.test(reason.reason)

  return (
    <Row label="Why she's calling">
      {!reason ? (
        <p className="text-[12px] text-white/35">Waiting for her to say.</p>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={[
                'rounded-lg px-3 py-1.5 font-heading text-[14px] font-semibold',
                resolved
                  ? 'bg-emerald/15 text-emerald-glow'
                  : 'bg-white/[0.05] text-white/45',
              ].join(' ')}
            >
              {reason.reason}
            </span>
            {resolved && reason.confidence > 0 && (
              <span className="text-[10px] text-white/35">
                {Math.round(reason.confidence * 100)}% confident · {timeOf(reason.at)}
              </span>
            )}
          </div>
          {reason.evidence && (
            <p className="mt-2 border-l-2 border-white/10 pl-3 text-[11.5px] italic leading-relaxed text-white/45">
              “{reason.evidence}”
            </p>
          )}
        </div>
      )}
    </Row>
  )
}

function SentimentRow({ intel }: { intel: JourneyIntel }) {
  const current = intel.sentiment
  const trail = intel.sentimentTrail

  return (
    <Row label="Sentiment">
      {!current ? (
        <p className="text-[12px] text-white/35">Not enough said yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={[
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold',
              SENTIMENT[current.label].bg,
              SENTIMENT[current.label].text,
            ].join(' ')}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${SENTIMENT[current.label].dot}`} />
            {SENTIMENT[current.label].label}
          </span>

          {trail.length > 1 && (
            <span className="flex items-center gap-1.5">
              {trail.map((point, i) => (
                <span key={`${point.at}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[10px] text-white/20">→</span>}
                  <span
                    className={[
                      'text-[10px]',
                      i === trail.length - 1
                        ? SENTIMENT[point.label].text
                        : 'text-white/30',
                    ].join(' ')}
                  >
                    {SENTIMENT[point.label].label}
                  </span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </Row>
  )
}

function RiskRow({ intel }: { intel: JourneyIntel }) {
  const risk = intel.risk
  const band = risk ? BAND[risk.band] : null

  return (
    <Row label="Retention risk">
      {!risk || !band ? (
        <p className="text-[12px] text-white/35">Scoring as she talks.</p>
      ) : (
        <div>
          <div className="flex items-end gap-3">
            <span className={`font-heading text-3xl font-bold leading-none ${band.text}`}>
              {risk.score}
            </span>
            <span className="pb-0.5 text-[11px] text-white/30">/ 100</span>
            <span
              className={`mb-0.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${band.ring} ${band.text}`}
            >
              {band.label}
              {risk.trend === 'rising' ? ' · rising' : risk.trend === 'falling' ? ' · easing' : ''}
            </span>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${band.bar}`}
              style={{ width: `${Math.max(2, risk.score)}%` }}
            />
          </div>

          {risk.drivers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {risk.drivers.map((driver) => (
                <span
                  key={driver}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/60"
                >
                  {driver}
                </span>
              ))}
            </div>
          )}

          {risk.quote && (
            <p className="mt-3 border-l-2 border-white/10 pl-3 text-[11.5px] italic leading-relaxed text-white/45">
              “{risk.quote}”
            </p>
          )}
        </div>
      )}
    </Row>
  )
}
