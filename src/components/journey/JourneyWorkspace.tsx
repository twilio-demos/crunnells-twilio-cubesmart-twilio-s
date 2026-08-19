'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookingStage } from './BookingStage'
import { CallPromptStage, LiveCallStage } from './CallStage'
import { DeskStage } from './DeskStage'
import { CubeSmartWordmark } from './EmeraldMark'
import { IntelligencePanel } from './IntelligencePanel'
import { PhoneThread } from './PhoneThread'
import { ProfilePane } from './ProfilePane'
import { SaveStage } from './SaveStage'
import { SignupStage, } from './SignupStage'
import { BEAT_ACTIONS, StoryRail } from './StoryRail'
import { useJourney } from '@/lib/journey/use-journey'
import type { FlexHealth, IntelHealth, JourneyBeat, RcsHealth } from '@/lib/journey/types'

function prettyPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw
}

export function JourneyWorkspace({ serverUrl }: { serverUrl?: string }) {
  const { config, state, profile, flex, connected, error, busy, setError, refresh, refreshFlex, run, api } =
    useJourney(serverUrl)
  const [started, setStarted] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const beatId = state?.beatId ?? (started ? 'signup' : 'setup')
  const completed = state?.completed ?? (started ? ['setup'] : [])
  const firedEvents = useMemo(() => (state?.events ?? []).map((e) => e.name), [state?.events])
  const beat: JourneyBeat | undefined = config?.beats.find((b) => b.id === beatId)

  const handleAction = useCallback(
    async (target: JourneyBeat) => {
      const action = BEAT_ACTIONS[target.id]
      if (!action) return
      if (action === 'advance') {
        setStarted(true)
        return
      }
      await run(target.id, () => api.post('action', { action }))
    },
    [api, run]
  )

  const handleBook = useCallback(
    async (slotId: string) => {
      await run('book', () => api.post('book', { slotId }))
    },
    [api, run]
  )

  const handleFlexRecheck = useCallback(async () => {
    await run('flex', () => refreshFlex(true))
  }, [refreshFlex, run])

  const handleForceHandoff = useCallback(async () => {
    await run('force-handoff', () => api.post('action', { action: 'force-handoff' }))
  }, [api, run])

  const handleReset = useCallback(async () => {
    await run('reset', () => api.post('reset', {}))
    setStarted(false)
    setConfirmReset(false)
  }, [api, run])

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deepspace px-6 text-center">
        <div>
          <p className="font-heading text-lg text-starwhite">Connecting to the store…</p>
          <p className="mt-2 max-w-md text-[13px] text-white/45">
            {error ??
              'Loading the CubeSmart guided move-in journey. If this hangs, the journey service needs a deploy to come online.'}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border border-white/15 px-4 py-2 text-[12px] text-white/60 hover:bg-white/5"
          >
            ← Back to the showcase
          </Link>
        </div>
      </div>
    )
  }

  const showPhone = beat?.stage !== 'desk'
  const restrictToDate = state && state.bookingRound === 2 ? config.thursday : undefined

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-deepspace text-starwhite">
      {/* Top bar */}
      <header className="shrink-0 border-b border-white/[0.07] bg-black/40 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <CubeSmartWordmark />

          <div className="hidden h-8 w-px bg-white/10 md:block" />

          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-starwhite">
              {state ? `${state.firstName} ${state.lastName}` : config.persona.firstName}
              <span className="ml-2 font-normal text-white/40">
                {state
                  ? state.lookup?.nationalFormat || prettyPhone(state.phone)
                  : `${config.persona.age} · new tenant`}
              </span>
            </p>
            <p className="truncate text-[10px] text-white/35">{config.persona.blurb}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <RcsChip rcs={config.rcs} />
            <IntelChip intel={config.intel} />
            <FlexChip flex={flex} />
            <span className="hidden rounded-full bg-white/[0.05] px-3 py-1 text-[10px] text-white/45 lg:inline">
              Store line {prettyPhone(config.studioPhone)}
            </span>
            <span
              className={[
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium',
                connected
                  ? 'bg-emerald/15 text-emerald-glow'
                  : 'bg-white/[0.05] text-white/40',
              ].join(' ')}
            >
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  connected ? 'bg-emerald animate-pulse' : 'bg-white/30',
                ].join(' ')}
              />
              {connected ? 'Live' : 'Polling'}
            </span>

            {confirmReset ? (
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy === 'reset'}
                  className="rounded-lg bg-red-500/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {busy === 'reset' ? 'Wiping…' : 'Delete profile & reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-white/50"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/60 transition hover:bg-white/5"
              >
                Reset demo
              </button>
            )}

            <Link
              href="/"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/60 transition hover:bg-white/5"
            >
              Exit
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
            <p className="text-[11px] text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[11px] text-red-300/70 hover:text-red-200"
            >
              dismiss
            </button>
          </div>
        )}

        {config.rcs && !config.rcs.ok && (
          <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5">
            <p className="text-[11px] text-amber-200">
              <span className="font-semibold">RCS is not ready:</span> {config.rcs.problem}
              {config.rcs.hint ? ` ${config.rcs.hint}` : ''}
            </p>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Story rail */}
        <aside className="shrink-0 border-b border-white/[0.07] px-4 py-4 lg:w-[352px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 no-scrollbar">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
            The story
          </p>
          <StoryRail
            beats={config.beats}
            beatId={beatId}
            completed={completed}
            firedEvents={firedEvents}
            busy={busy}
            onAction={handleAction}
          />
        </aside>

        {/* Stage */}
        <main className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 md:px-6 lg:flex-row lg:overflow-hidden">
          <div className="min-h-0 flex-1 lg:overflow-y-auto no-scrollbar">
            {beat?.stage === 'narration' && (
              <NarrationStage
                title={beat.title}
                narration={beat.narration}
                mechanic={beat.mechanic}
              />
            )}

            {beat?.stage === 'signup' && (
              <SignupStage
                config={config}
                onComplete={async () => {
                  await refresh()
                }}
              />
            )}

            {beat?.stage === 'thread' && (
              <WatchPanel title={beat.title} narration={beat.narration} mechanic={beat.mechanic} />
            )}

            {beat?.stage === 'booking' && (
              <BookingStage
                config={config}
                state={state}
                restrictToDate={restrictToDate}
                busy={busy === 'book'}
                onBook={handleBook}
              />
            )}

            {beat?.stage === 'call-prompt' &&
              (state?.callStatus === 'in-call' ? (
                <>
                  <LiveCallStage
                    state={state}
                    onForceHandoff={beat.id === 'voice-callback' ? handleForceHandoff : undefined}
                    forcing={busy === 'force-handoff'}
                  />
                  <IntelligencePanel
                    intel={state.intel}
                    live
                    configured={Boolean(config.intel?.configId)}
                  />
                </>
              ) : (
                <>
                  <CallPromptStage
                    config={config}
                    state={state}
                    variant={beat.id === 'after-hours' ? 'after-hours' : 'callback'}
                  />
                  {state?.intel && state.intel.totalRuns > 0 && (
                    <IntelligencePanel
                      intel={state.intel}
                      live={false}
                      configured={Boolean(config.intel?.configId)}
                    />
                  )}
                </>
              ))}

            {beat?.stage === 'call-live' && (
              <>
                <LiveCallStage state={state} />
                <IntelligencePanel
                  intel={state?.intel}
                  live={state?.callStatus === 'in-call'}
                  configured={Boolean(config.intel?.configId)}
                />
              </>
            )}

            {beat?.stage === 'desk' && (
              <>
                <DeskStage
                  state={state}
                  flex={flex}
                  busy={busy === 'flex'}
                  onRecheck={handleFlexRecheck}
                />
                {state?.intel && state.intel.totalRuns > 0 && (
                  <IntelligencePanel
                    intel={state.intel}
                    live={state.callStatus === 'in-call'}
                    configured={Boolean(config.intel?.configId)}
                  />
                )}
              </>
            )}

            {beat?.stage === 'save' && (
              <>
                <SaveStage
                  config={config}
                  state={state}
                  busy={busy === 'save'}
                  onComplete={() => handleAction(beat)}
                />
                {state?.intel && state.intel.totalRuns > 0 && (
                  <IntelligencePanel
                    intel={state.intel}
                    live={state.callStatus === 'in-call'}
                    configured={Boolean(config.intel?.configId)}
                  />
                )}
              </>
            )}
          </div>

          {showPhone && (
            <div className="mx-auto h-[540px] w-full max-w-[340px] shrink-0 lg:h-auto lg:max-h-full">
              <PhoneThread
                messages={state?.messages ?? []}
                emptyHint="His handset. Every message on this thread is really sent — branded RCS from the CubeSmart sender, with SMS fallback."
              />
            </div>
          )}
        </main>

        {/* Profile */}
        <aside className="shrink-0 border-t border-white/[0.07] px-4 py-5 lg:w-[330px] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-5 no-scrollbar">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
            Unified Profile · Twilio Memory
          </p>
          <ProfilePane state={state} profile={profile} />
        </aside>
      </div>
    </div>
  )
}

/** Honest, at-a-glance state of the RCS sender the demo will actually send through. */
function RcsChip({ rcs }: { rcs?: RcsHealth }) {
  if (!rcs) return null

  const tone = rcs.ok
    ? 'bg-sky-400/15 text-sky-300'
    : 'bg-amber-400/15 text-amber-300'
  const label = rcs.ok
    ? `RCS · ${rcs.displayName ?? 'sender ready'}`
    : 'RCS not ready'
  const title = rcs.ok
    ? `Sending as "${rcs.displayName}" (${rcs.senderId}), status ${rcs.senderStatus ?? 'unknown'}. A DRAFT sender only reaches handsets that accepted the tester invite.`
    : `${rcs.problem ?? ''} ${rcs.hint ?? ''}`.trim()

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium md:inline-flex ${tone}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

/** Are the live Language Operators actually attached to the call? */
function IntelChip({ intel }: { intel?: IntelHealth }) {
  if (!intel?.configId) return null

  const tone = intel.ok ? 'bg-violet-400/15 text-violet-300' : 'bg-amber-400/15 text-amber-300'
  const label = intel.ok
    ? `CINTEL · ${intel.operators.length} operators`
    : 'CINTEL not ready'
  const title = intel.ok
    ? `"${intel.configName}" runs live on the call and posts results to ${intel.webhookUrl}. Grounded in the store's retention playbook in Enterprise Knowledge.`
    : `${intel.problem ?? ''} ${intel.hint ?? ''}`.trim()

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium md:inline-flex ${tone}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

/** Whether the Act 4 handoff has a real human waiting in Flex. */
function FlexChip({ flex }: { flex: FlexHealth | null }) {
  if (!flex?.configured) return null

  const tone = flex.ok ? 'bg-emerald/15 text-emerald-glow' : 'bg-amber-400/15 text-amber-300'
  const label = flex.ok
    ? `Flex · ${flex.workersAvailable} available`
    : 'Flex · no agent online'
  const title = flex.ok
    ? `Handoff will route to ${flex.queueName ?? 'the Flex queue'} via ${flex.workflowName ?? 'the Flex workflow'}. Available: ${flex.availableWorkerNames.join(', ')}`
    : `${flex.problem ?? ''} ${flex.hint ?? ''}`.trim()

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium md:inline-flex ${tone}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

function NarrationStage({
  title,
  narration,
  mechanic,
}: {
  title: string
  narration: string
  mechanic: string
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl items-center">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-glow">
          Set the scene
        </p>
        <h2 className="mt-3 font-heading text-2xl font-semibold text-starwhite">{title}</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/75">{narration}</p>
        <p className="mt-5 border-l-2 border-emerald/40 pl-4 text-[12px] leading-relaxed text-emerald-glow/70">
          {mechanic}
        </p>
      </div>
    </div>
  )
}

function WatchPanel({
  title,
  narration,
  mechanic,
}: {
  title: string
  narration: string
  mechanic: string
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-glow">
          Watch his phone
        </p>
        <h2 className="mt-2.5 font-heading text-xl font-semibold text-starwhite">{title}</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/75">{narration}</p>
        <p className="mt-4 border-l-2 border-emerald/40 pl-4 text-[12px] leading-relaxed text-emerald-glow/70">
          {mechanic}
        </p>
      </div>
    </div>
  )
}
