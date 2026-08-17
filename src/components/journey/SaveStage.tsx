'use client'

import type { JourneyConfig, JourneyState } from '@/lib/journey/types'

/**
 * Act 4, step 13 — the operators write back.
 *
 * The handoff to Flex did not end the conversation. ConversationRelay tore down,
 * Real-Time Transcription took over on the same call, and the same Language
 * Operators kept scoring what she said to the human. When the retention score
 * crossed the studio's threshold, two things happened without anyone clicking
 * anything: an event was written to her Unified Profile, and the recommended save
 * was released to the agent's screen in Flex.
 *
 * This panel shows that happening, then records what the human did with it.
 */
export function SaveStage({
  config,
  state,
  busy,
  onComplete,
}: {
  config: JourneyConfig
  state: JourneyState | null
  busy: boolean
  onComplete: () => void
}) {
  const threshold = config.riskThreshold ?? 60
  const score = state?.intel?.risk?.score ?? 0
  const crossed = Boolean(state?.riskThresholdAt)
  const drivers = state?.intel?.risk?.drivers ?? []
  const quote = state?.intel?.risk?.quote
  const saved = state?.save
  const offer = config.saveOffer
  const memberLines = (state?.transcript ?? []).filter((l) => l.role === 'member').slice(-6)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* What is happening right now */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-glow">
          The operators are still listening
        </p>
        <h2 className="mt-2 font-heading text-xl font-semibold text-starwhite">
          She is with a human — and still being scored
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-white/70">
          The call was handed to Flex, not ended. Real-Time Transcription picked up where
          ConversationRelay left off on the same call, so the same operators keep reading the
          conversation between {state?.firstName ?? 'her'} and your agent. Nothing here is replayed
          or simulated.
        </p>
      </div>

      {/* The threshold */}
      <div
        className={[
          'rounded-2xl border p-5 transition-colors',
          crossed
            ? 'border-amber-400/45 bg-amber-400/[0.08]'
            : 'border-white/[0.08] bg-white/[0.02]',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Retention risk · threshold {threshold}
          </p>
          <span
            className={[
              'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider',
              crossed
                ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40'
                : 'bg-white/[0.06] text-white/40',
            ].join(' ')}
          >
            {crossed ? 'Threshold crossed' : 'Watching'}
          </span>
        </div>

        <ThresholdMeter score={score} threshold={threshold} crossed={crossed} />

        {drivers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {drivers.map((d) => (
              <span
                key={d}
                className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] text-white/70"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {quote && (
          <p className="mt-3 border-l-2 border-amber-400/40 pl-3 text-[12px] italic leading-relaxed text-white/60">
            “{quote}”
          </p>
        )}

        {crossed ? (
          <div className="mt-4 rounded-xl border border-emerald/30 bg-emerald/[0.07] px-4 py-3">
            <p className="text-[12px] leading-relaxed text-emerald-glow">
              <span className="font-semibold">Retention Risk Threshold Reached</span> was written to
              her Unified Profile in Twilio Memory at{' '}
              {new Date(state!.riskThresholdAt!).toLocaleTimeString()} — by a Language Operator,
              mid-call. Look at the Events list on the right.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-[11.5px] leading-relaxed text-white/45">
            The score climbs when she says she found a cheaper unit down the street, isn&apos;t sure
            it&apos;s worth the money, or is thinking about moving out. Say those things on the call
            and watch this move.
          </p>
        )}
      </div>

      {/* The recommendation — deliberately not shown here */}
      <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          The recommended save · Flex only
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-white/70">
          {crossed
            ? 'The offer has been released and merged onto the live Flex task. It is on your agent‑s screen now — read it to her from there.'
            : 'The operator has a recommendation parked. It is released to the agent the moment the score crosses the threshold.'}
        </p>
        {offer && (
          <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
            <OfferCard label="Discount offer" value={offer.classCredit} />
            <OfferCard label="Downsize option" value={offer.coaching} />
          </div>
        )}
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/35">
          The exact wording is stripped out server-side before state ever reaches this screen — the
          room can never see the play before the agent makes it. Both offers come from the store&apos;s
          own retention playbook in Twilio Enterprise Knowledge.
        </p>
      </div>

      {/* What she said to the human */}
      <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          What she is telling your agent
        </p>
        {memberLines.length === 0 ? (
          <p className="text-[11.5px] text-white/30">
            Nothing captured yet on this leg of the call.
          </p>
        ) : (
          <div className="space-y-2">
            {memberLines.map((line) => (
              <p key={line.id} className="text-[12px] leading-relaxed text-white/80">
                “{line.text}”
              </p>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10.5px] text-white/35">
          Read back from Conversation Orchestrator — the same conversation the AI stretch of this
          call is in.
        </p>
      </div>

      {/* Record the save */}
      {saved ? (
        <div className="rounded-2xl border border-emerald/40 bg-emerald/[0.08] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-glow">
            Saved
          </p>
          <h3 className="mt-2 font-heading text-lg font-semibold text-starwhite">
            {state?.firstName} stayed
          </h3>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <OfferCard label="New card on file" value={`Visa •••• ${saved.cardLast4} exp ${saved.cardExpiry}`} />
            <OfferCard label="Account" value="Active — access restored" />
            <OfferCard label="Applied" value={saved.classCredit} />
            <OfferCard label="Applied" value={saved.coaching} />
          </div>
          <p className="mt-3.5 text-[12px] leading-relaxed text-white/70">
            The confirmation is on her handset, and everything the store team did is on her profile
            alongside the event the operator wrote. One lease that would have quietly lapsed at 8pm
            on a Tuesday, kept.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          className="w-full rounded-xl bg-emerald px-5 py-4 font-heading text-sm font-semibold text-emerald-ink transition hover:bg-emerald-glow disabled:opacity-60"
        >
          {busy ? 'Recording the save…' : 'New card taken — complete the save'}
        </button>
      )}
    </div>
  )
}

function ThresholdMeter({
  score,
  threshold,
  crossed,
}: {
  score: number
  threshold: number
  crossed: boolean
}) {
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between">
        <span
          className={[
            'font-heading text-3xl font-semibold tabular-nums',
            crossed ? 'text-amber-300' : 'text-starwhite',
          ].join(' ')}
        >
          {score}
          <span className="ml-1 text-[13px] font-normal text-white/35">/ 100</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={[
            'h-full rounded-full transition-all duration-700',
            crossed ? 'bg-amber-400' : 'bg-emerald',
          ].join(' ')}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-white/50"
          style={{ left: `${threshold}%` }}
          aria-hidden
        />
      </div>
    </div>
  )
}

function OfferCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium leading-snug text-white/85">{value}</p>
    </div>
  )
}
