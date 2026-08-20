'use client'

import type { FlexHealth, JourneyState } from '@/lib/journey/types'

/**
 * The real Twilio Flex handoff.
 *
 * There is no simulated contact centre here. When the voice agent escalates, the
 * live call is redirected into the account's Flex TaskRouter workflow as a
 * genuine voice task. This panel shows the true state of that task — its SID,
 * the queue it landed in, and which Flex agent accepted it — alongside the exact
 * context payload the agent receives.
 */
export function DeskStage({
  state,
  flex,
  busy,
  onRecheck,
}: {
  state: JourneyState | null
  flex: FlexHealth | null
  busy: boolean
  onRecheck: () => void
}) {
  const escalation = state?.escalation
  const handoff = state?.flex
  const intel = state?.intel
  const recent = (state?.transcript ?? []).slice(-12)
  const flexUrl = flex?.flexUrl || 'https://flex.twilio.com/agent-desktop'
  const forwarded = handoff?.mode === 'forwarded'

  const stage: 'waiting' | 'queued' | 'ringing' | 'live' | 'forwarded' | 'wrapped' | 'failed' = (() => {
    if (handoff?.error) return 'failed'
    if (!handoff?.transferred) return 'waiting'
    if (forwarded) return 'forwarded'
    if (handoff.worker && handoff.status === 'assigned') return 'live'
    if (handoff.status === 'completed' || handoff.status === 'wrapping') return 'wrapped'
    if (handoff.status === 'reserved') return 'ringing'
    return 'queued'
  })()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Readiness */}
      <FlexReadiness flex={flex} busy={busy} onRecheck={onRecheck} flexUrl={flexUrl} />
      <PluginStatus flex={flex} />

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-black/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <FlexMark />
            <div>
              <p className="text-[12px] font-semibold text-starwhite">
                {forwarded ? 'Direct call forward' : 'Twilio Flex'}
              </p>
              <p className="text-[10px] text-white/40">
                {forwarded
                  ? `Ringing the store team at ${handoff?.forwardedTo ?? flex?.forwardNumber ?? 'the fallback number'} directly`
                  : `${flex?.workflowName ? `${flex.workflowName} · ` : ''}${flex?.queueName ?? 'Voice task routing'}`}
              </p>
            </div>
          </div>
          <StageBadge stage={stage} />
        </div>

        {stage === 'waiting' && !escalation ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[13px] text-white/45">
              Nothing has been transferred yet. When the voice agent escalates, this call either
              lands on a real Flex agent as a TaskRouter voice task, or — if nobody is available —
              forwards straight to the store team&apos;s phone.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 p-5 lg:grid-cols-[1.05fr_1fr]">
            <div className="space-y-4">
              {handoff?.error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300">
                    Transfer failed
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-red-200/85">
                    {handoff.error}
                  </p>
                </div>
              )}

              {escalation && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Why the AI escalated
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-starwhite">
                    {escalation.reason}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/65">
                    {escalation.summary}
                  </p>
                </div>
              )}

              {forwarded ? (
                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                    Direct call forward
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Fact
                      label="Ringing"
                      value={handoff?.forwardedTo ?? flex?.forwardNumber ?? '—'}
                      tone="warn"
                    />
                    <Fact label="Reason" value={flex?.ok ? 'Flex agent unavailable' : (flex?.problem ?? 'Flex not ready')} />
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-white/35">
                    No Flex agent was available, so the live call was dialled straight to the store
                    team&apos;s phone instead — the demo always reaches a real person.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                    Live TaskRouter task
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Fact label="Task SID" value={handoff?.taskSid ?? 'creating…'} mono />
                    <Fact
                      label="Assignment"
                      value={handoff?.status ?? '—'}
                      tone={stage === 'live' ? 'good' : stage === 'failed' ? 'bad' : 'warn'}
                    />
                    <Fact label="Queue" value={handoff?.queue ?? flex?.queueName ?? '—'} />
                    <Fact
                      label="Accepted by"
                      value={handoff?.worker ?? 'waiting for an agent'}
                      tone={handoff?.worker ? 'good' : 'warn'}
                    />
                    <div className="col-span-2">
                      <Fact
                        label="Workflow"
                        value={
                          handoff?.workflowSid || flex?.workflowSid
                            ? `${flex?.workflowName ?? 'Workflow'} · ${handoff?.workflowSid ?? flex?.workflowSid}`
                            : '—'
                        }
                        mono
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  What the agent&apos;s screen shows
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Fact label="Member" value={`${state?.firstName ?? ''} ${state?.lastName ?? ''}`} />
                  <Fact label="Phone" value={state?.lookup?.nationalFormat || state?.phone || ''} />
                  <Fact label="Home store" value="West 7th · Denver" />
                  <Fact label="Unit type" value={state?.membership.tier ?? ''} />
                  <Fact
                    label="Account status"
                    value={state?.membership.status === 'on-hold' ? 'Extended access granted' : 'Active'}
                    tone="warn"
                  />
                  <Fact
                    label="Access window"
                    value={
                      state?.membership.holdStart && state?.membership.holdEnd
                        ? `${state.membership.holdStart} → ${state.membership.holdEnd}`
                        : '—'
                    }
                  />
                  <div className="col-span-2">
                    <Fact
                      label="Failed charge"
                      value={
                        state?.membership.paymentStatus === 'expired'
                          ? `${state.membership.failedChargeAmount ?? ''} declined · Visa •••• ${state.membership.cardLast4} expired ${state.membership.cardExpiry}`
                          : 'None'
                      }
                      tone="bad"
                    />
                  </div>
                  <div className="col-span-2">
                    <Fact
                      label="Reservation history"
                      value={
                        (state?.classes ?? [])
                          .map((c) => `${c.className} ${c.dayName} ${c.timeLabel} (${c.status})`)
                          .join(' · ') || 'None on record'
                      }
                    />
                  </div>
                  {state?.fuelOrder && (
                    <div className="col-span-2">
                      <Fact label="Usual supply order" value={state.fuelOrder.name} />
                    </div>
                  )}
                  {intel?.reason && (
                    <div className="col-span-2">
                      <Fact label="Why he's calling" value={intel.reason.reason} />
                    </div>
                  )}
                  {intel?.risk && (
                    <Fact
                      label="Retention risk"
                      value={`${intel.risk.score} / 100 · ${intel.risk.band}`}
                      tone={intel.risk.score >= 60 ? 'bad' : intel.risk.score >= 25 ? 'warn' : 'good'}
                    />
                  )}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-white/35">
                  {forwarded
                    ? "This is what a Flex agent's screen would show if this call had landed there — the same context is available to whoever picks up the forwarded call."
                    : 'All of this travels on the task attributes, and the CubeSmart Tenant Context plugin renders it in Flex — so it is on screen before the agent says a word.'}
                </p>
              </div>

              {intel?.nextBestAction && (
                <div className="rounded-xl border border-violet-400/30 bg-violet-400/[0.08] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                    Recommended save · Conversation Intelligence
                  </p>
                  <p className="mt-1.5 text-[13px] font-semibold text-starwhite">
                    {intel.nextBestAction.headline}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                    {intel.nextBestAction.offer}
                  </p>
                  {intel.nextBestAction.rationale && (
                    <p className="mt-2 text-[11px] italic leading-relaxed text-white/45">
                      {intel.nextBestAction.rationale}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] text-violet-200/60">
                    {intel.nextBestAction.policySource && <span>Source: {intel.nextBestAction.policySource}</span>}
                    {intel.nextBestAction.urgency && <span>· {intel.nextBestAction.urgency}</span>}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {forwarded ? (
                  <div className="flex-1 rounded-lg border border-emerald/30 bg-emerald/[0.08] px-4 py-3 text-center">
                    <p className="text-[12px] font-semibold text-emerald-glow">
                      Ringing {handoff?.forwardedTo ?? flex?.forwardNumber} now
                    </p>
                  </div>
                ) : (
                  <a
                    href={flexUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-lg bg-emerald px-4 py-3 text-center font-heading text-sm font-semibold text-emerald-ink transition hover:bg-emerald-glow"
                  >
                    Open Flex to answer →
                  </a>
                )}
                <button
                  type="button"
                  onClick={onRecheck}
                  disabled={busy}
                  className="rounded-lg border border-white/15 px-4 py-3 text-[12px] text-white/65 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {busy ? 'Checking…' : 'Refresh task'}
                </button>
              </div>

              {stage === 'live' && (
                <div className="rounded-lg border border-emerald/30 bg-emerald/[0.08] px-4 py-3">
                  <p className="text-[12px] text-emerald-glow">
                    {handoff?.worker} is on the call with everything already on screen.{' '}
                    {state?.firstName} never had to repeat himself — that&apos;s the save.
                  </p>
                </div>
              )}

              {stage === 'forwarded' && (
                <div className="rounded-lg border border-emerald/30 bg-emerald/[0.08] px-4 py-3">
                  <p className="text-[12px] text-emerald-glow">
                    The store team&apos;s phone is ringing directly with everything already summarised
                    above. {state?.firstName} never had to repeat himself — that&apos;s the save.
                  </p>
                </div>
              )}
            </div>

            {/* Last 60 seconds */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Last 60 seconds of the call
              </p>
              <div className="max-h-[46vh] space-y-2.5 overflow-y-auto no-scrollbar">
                {recent.length === 0 && (
                  <p className="text-[11px] text-white/30">No transcript captured.</p>
                )}
                {recent.map((line) => (
                  <div key={line.id}>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-white/35">
                      {line.role === 'member'
                        ? (state?.firstName ?? 'Member')
                        : line.role === 'agent'
                          ? 'Voice AI'
                          : 'System'}
                    </p>
                    <p
                      className={[
                        'text-[11.5px] leading-relaxed',
                        line.role === 'member' ? 'text-white/85' : 'text-white/60',
                      ].join(' ')}
                    >
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Is the member context panel actually live inside Flex? */
function PluginStatus({ flex }: { flex: FlexHealth | null }) {
  if (!flex?.configured) return null

  if (flex.pluginReleased) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-glow" />
        <p className="text-[11.5px] text-white/60">
          <span className="font-semibold text-starwhite">Tenant Context panel is live in Flex</span>{' '}
          — the agent sees his unit lease, access window, declined card, reservation history and the
          AI&apos;s summary in the panel beside the call.
        </p>
        {flex.pluginVersion && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] text-white/40">
            v{flex.pluginVersion}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] px-4 py-2.5">
      <p className="text-[11.5px] text-white/60">
        <span className="font-semibold text-starwhite">Tenant Context panel not detected</span> — the
        context still reaches Flex on the task, but Flex won&apos;t display it until the panel is
        released to the agent desktop.
      </p>
    </div>
  )
}

/** Honest, up-front warning if the handoff has nowhere to land. */
function FlexReadiness({
  flex,
  busy,
  onRecheck,
  flexUrl,
}: {
  flex: FlexHealth | null
  busy: boolean
  onRecheck: () => void
  flexUrl: string
}) {
  if (!flex) return null

  if (flex.ok) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald/30 bg-emerald/[0.07] px-4 py-3">
        <p className="text-[12px] text-emerald-glow">
          Flex is ready — {flex.workersAvailable} agent
          {flex.workersAvailable === 1 ? '' : 's'} available
          {flex.availableWorkerNames.length ? ` (${flex.availableWorkerNames.join(', ')})` : ''}.
        </p>
        <button
          type="button"
          onClick={onRecheck}
          disabled={busy}
          className="text-[11px] text-emerald-glow/70 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {busy ? 'checking…' : 'check again'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-400/35 bg-amber-400/[0.09] px-4 py-3">
      <p className="text-[12px] font-semibold text-amber-200">
        {flex.forwardNumber ? 'No Flex agent online — forwarding instead' : "Flex isn't ready to take the call"}
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-amber-100/80">
        {flex.problem} {flex.hint}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a
          href={flexUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/30"
        >
          Open Flex
        </a>
        <button
          type="button"
          onClick={onRecheck}
          disabled={busy}
          className="rounded-lg border border-amber-300/30 px-3 py-1.5 text-[11px] text-amber-100/80 hover:bg-amber-400/10 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </div>
  )
}

function StageBadge({
  stage,
}: {
  stage: 'waiting' | 'queued' | 'ringing' | 'live' | 'forwarded' | 'wrapped' | 'failed'
}) {
  const map: Record<typeof stage, { label: string; className: string }> = {
    waiting: { label: 'Idle', className: 'bg-white/[0.06] text-white/40' },
    queued: {
      label: 'In queue',
      className: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40',
    },
    ringing: {
      label: 'Ringing an agent',
      className: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40',
    },
    live: {
      label: 'Agent connected',
      className: 'bg-emerald/20 text-emerald-glow ring-1 ring-emerald/40',
    },
    forwarded: {
      label: 'Forwarded to store team',
      className: 'bg-emerald/20 text-emerald-glow ring-1 ring-emerald/40',
    },
    wrapped: { label: 'Wrapped up', className: 'bg-white/[0.08] text-white/55' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40' },
  }
  const item = map[stage]
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${item.className}`}
    >
      {item.label}
    </span>
  )
}

function FlexMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F22F46]">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="9" cy="12" r="1.9" fill="#fff" />
        <circle cx="15" cy="12" r="1.9" fill="#fff" />
      </svg>
    </span>
  )
}

function Fact({
  label,
  value,
  tone,
  mono,
}: {
  label: string
  value: string
  tone?: 'warn' | 'bad' | 'good'
  mono?: boolean
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
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p
        className={`text-[11.5px] font-medium ${toneClass} ${mono ? 'break-all font-mono text-[10.5px]' : ''}`}
      >
        {value || '—'}
      </p>
    </div>
  )
}
