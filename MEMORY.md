# Project Memory

## Session 66 — Fixing the fallout from Session 65 (duplicates, repetition, stalled callback)

**1. Duplicated transcript lines (my bug from Session 65).** `syncConversationTranscript` was
mirroring the WHOLE conversation, including the AI stretch this app already has from the relay turns.
Two reasons it can never be deduped by text alone: Twilio splits each TTS reply into 3–5 separate
communications ("Each text-to-speech fragment is a separate communication" — orchestrator/channels
docs), and her utterances arrive fragmented/differently punctuated from what the relay reported.
**Fix:** the mirror now only runs when `state.flex?.transferred`, only takes communications with
`occurredAt >= transferredAt + 2000` (the +2s skips the AI's own "Connecting you…" `<Say>` line, which
is already in the transcript), and only takes lines authored by the MEMBER (post-transfer that is all
Orchestrator captures anyway — the Flex worker leg is not transcribed). Pre-handoff ids are still
marked seen so they're never reconsidered.
Belt and braces: `addTranscript` in `state.ts` now drops an identical consecutive line (same role,
same trimmed text, within 8s) — but only when `text.length > 3`, so a genuinely repeated "yes" is
still shown.

**2. Agent repeating "I can see your membership is on hold and set to end on …" forever.** The model
re-ran step 1 of the prompt every turn. **Fix:** new `alreadySaid(state)` appended to `styleFor()` —
injects the last 6 agent transcript lines with "do not say any of it again, and do not say anything
that means the same thing; move FORWARD". Applies to both prompts.

**3. The callback stalling / never mentioning the expired card.** ROOT CAUSE: `callbackPrompt` said
"react warmly FIRST … Do not mention any problem in this turn" and "Then, on your NEXT turn, call
check_payment_method". So the agent ended its turn and waited for her to speak — and she was waiting
for it. Dead air, then the model looped back to step 1. **Fix:** restructured into 3 STAGES (not
numbered steps), where Stage 2 explicitly does warm reaction → `check_payment_method` → expired-card
news → ask permission ALL IN ONE TURN ("Do NOT end your turn after the warm sentence"). `stepCountIs(4)`
already allowed text+tool+text. The `check_payment_method` tool's return string now also instructs
both remaining sentences. Added `state.paymentCheckedOnCall` (compared to `state.callCount`) so the
prompt's "you already checked" branch is per-call — using `membership.paymentStatus === "expired"`
was wrong because it stays expired across a repeat run and made the agent think it had already
broken the news on a fresh call.

**4. Agent could not hang up.** New `end_call` tool (requires quoting what she said that means she's
done) → `hangUpAfterGoodbye(state, 6500)` schedules
`calls(callSid).update({status:"completed"})` after 6.5s so ConversationRelay's TTS actually plays the
goodbye first (hanging up immediately means she hears nothing). New `state.hangingUp` guard makes
`handleJourneyVoiceTurn` return undefined for anything picked up in that closing window, and is reset
at the start of each call. `holdPrompt` gained step 8 (she says no → one goodbye + `end_call` in the
same turn) plus a hard rule never to ask "anything else" twice. Needed a `twilio` REST client in
`voice.ts` (there wasn't one).

**5. Demo escape hatch.** New `force-handoff` action in `routes.ts` (imports `escalateToDesk`) with a
canned reason/summary, surfaced as a "Hand off to Flex now" button in the footer of `LiveCallStage`
(new optional `onForceHandoff`/`forcing` props, only rendered on the `voice-callback` beat while
in-call and not already transferred). Performs the real transfer, so a stalled agent can never strand
a live demo.

## Session 65 — CONFIRMED: CINTEL keeps running after the Flex handoff (I was wrong first)
User pushed back on my claim that operators stop when the call leaves the AI agent. **They were right.**
Verified three ways:
1. `conv_configuration_01kfy8k1k1fx0rfcsa6qcsns1c` has **bidirectional VOICE capture rules for
   +18668144982** (and +15129004759). Docs: "When you save voice capture rules, Conversation
   Orchestrator automatically provisions call filtering and real-time transcription for matching calls."
2. Twilio docs (conversations/orchestrator/concepts/ingestion) state verbatim: *"The full interaction
   — AI portion and human portion — lives in one conversation. You pay for Conversation Relay STT
   during the AI portion, then Real-Time Transcription STT during the human portion."*
3. Live proof: `GET /v2/Conversations/{id}/Communications` on a real call showed the AI's
   "Connecting you to the West seventh front desk now" line, and THEN more CUSTOMER transcriptions
   ("I've not really been feeling this gym membership… backflip off the treadmill… went ouchie big
   time"). Only the CUSTOMER side is captured post-transfer (the Flex worker leg isn't).
   Shape: newest-first, `content.type === "TRANSCRIPTION"`, `content.text`, `author.address`,
   `occurredAt`, `id`, `resourceId` = `GT…#n.0`.
COST NOTE (not changed, flagged only): having voice capture rules AND TAC injecting
`conversationConfiguration` into ConversationRelay means STT is billed twice during the AI stretch.
Removing the capture rules would break the human-leg coaching, so leave it.

**ROOT CAUSE of "NBA never shows in Flex":** `memberRaisedCancellation()` read `state.transcript`,
which this app only populates from ConversationRelay turns. After the handoff those stop, so the gate
could never open during the human leg — exactly when the offer is needed. Not a rendering bug; the
plugin bundle already renders `intelligence.next_best_action`.

### Changes
- **`intel.ts`**: `memberRaisedCancellation` → **`retentionRiskRaised(state)`**, true if ANY of:
  (a) `intel.risk.score >= RETENTION_RISK_THRESHOLD` (60), (b) a member transcript line matches
  `CANCEL_INTENT` **or** a new `DISSATISFACTION` regex (no results / not using it / waste of money /
  hurt / injured / pulled / strained / tweaked / knee|back|shoulder|hamstring|ankle|wrist / in pain /
  sore for days), (c) the operators' OWN `risk.quote`, `reason.evidence` or `risk.drivers` match.
  (c) is the important one — it works with zero dependence on our transcript.
  New `noteRiskThreshold()` fires `EVENTS.RETENTION_RISK_THRESHOLD` once per run via **dynamic
  `import("./engine.js")`** (engine → flex → intel would otherwise cycle). `applyRuleExecution` now
  calls `releasePendingNextBestAction(state)` in its `changed` block so a risk result in the same
  batch immediately promotes a parked offer. `intelForTask` gained
  `retention_risk_threshold`/`_crossed`/`_at`.
- **NEW `server/src/journey/orchestrator.ts`** — `syncConversationTranscript(state, conversationId)`:
  GETs 40 communications, reverses to oldest-first, maps `author.address === state.phone` → member
  else agent, dedupes on `state.seenCommunicationIds` (capped 200) AND on identical role+text (the AI
  stretch is already in the transcript from relay turns). Module-level `inFlight` guard. Called from
  `/journey/cintel` with `payload.conversationId`, then `releasePendingNextBestAction`.
- **`script.ts`**: `RETENTION_RISK_THRESHOLD = 60`, `SAVE_OFFER` ({classCredit, coaching, label}),
  `EVENTS.RETENTION_RISK_THRESHOLD = "Retention Risk Threshold Reached"` and
  `EVENTS.MEMBERSHIP_REACTIVATED = "Membership Reactivated"`. `BeatStage` gained `"save"`.
  Reminder beat narration/waiting now say to tap **Confirm** (reschedule is Act 2). New **13th beat
  `save`** ("Coached in real time, then saved", stage `save`, action `complete-save`).
- **CRITICAL ORDERING BUG avoided**: `escalateToDesk` used to call `completeBeat(state,"flex")`,
  which was harmless when `flex` was the LAST beat. With a 13th beat it would have skipped the Flex
  desk panel entirely. Removed that line; instead **`fetchFlexTask` advances `flex` → `save` only
  when `worker && assignmentStatus === "assigned"`** (a human really picked up). `flex.ts` now
  imports `completeBeat`.
- **`engine.ts`**: new `completeSave(state)` — card → Visa ••••8821 exp 11/29, membership active,
  paymentStatus current, clears failed charge, `state.save`, Memory traits (`saveOfferApplied`,
  `classCreditBalance`), system transcript line, fires `MEMBERSHIP_REACTIVATED`, sends a real RCS
  confirmation, sets `callStatus: "ended"`. Deliberately does NOT fire the threshold event — that one
  belongs to the operators.
- **`state.ts`**: `riskThresholdAt`, `riskThresholdScore`, `seenCommunicationIds`, `save`.
- **`routes.ts`**: `complete-save` action; `/journey/config` now returns `riskThreshold` + `saveOffer`.
- **`voice.ts`**: callbackPrompt injury clause (acknowledge + ask if she's alright, still forbidden
  from offering anything, never give medical advice).
- **`provision-cintel.cjs`**: playbook rewritten — "WIN-BACK CLASS"/"COACHING RESET" renamed to
  **ONE-TIME CLASS CREDIT** + **PERSONAL COACHING CONSULTATION**, injury added as a first-class risk
  signal and as an approval reason, "no medical advice" added to Never Offered, threshold-60 rule
  documented. Risk + NBA operator prompts updated for injury and for "the conversation may be with a
  human". **Knowledge sources are create-by-name-and-reuse, so editing PLAYBOOK alone does nothing** —
  added `SOURCE_NAME = 'retention-playbook-v2'` + `SOURCE_PREFIX = 'retention-'` and a loop that
  DELETEs any older `retention-*` source so the operators aren't grounded in two contradictory
  playbooks. Ran it: retired `retention-save-playbook`, created
  `know_knowledge_01kzvnv7hye9785w79j441s3xx`, operators bumped a version.
- **UI**: new `src/components/journey/SaveStage.tsx` (threshold meter with a tick mark at 60, drivers,
  operator quote, "written to her profile at HH:MM" callout, the two offer cards labelled Flex-only,
  the human-leg member lines read back from Orchestrator, and the complete-save button / saved
  summary). Wired into `JourneyWorkspace` for `stage === 'save'` (phone stays visible so the
  confirmation RCS is seen). `StoryRail` ACTIONS gained `save: 'complete-save'` and now renders the
  `waiting` hint **and** the button together (was either/or) — the save beat needs both.
  `use-journey.ts` also polls on beat `save`. `types.ts` mirrored.
- Flex plugin re-verified (`npm run verify:plugin` → PLUGIN_RENDER_OK at 1.1.1); no bundle change
  needed since `next_best_action` was already rendered first in the CRM panel.

## Session 64 — CLONE REPOINTING (read this first if the demo "sends but never receives")
Chat `ae4287a5-533a-48be-9cc8-34240a73236d` is a CLONE. New hosts:
- Railway/journey service: `https://bpwilke-xplor-twilio-showcase-final-production.up.railway.app`
- Vercel project: `bpwilke-xplor-twilio-showcase-final`
- OLD host (still referenced all over the Twilio account at session start):
  `https://bpwilke-xplor-twilio-showcase-wilke-production.up.railway.app`

Credentials: the chat started on the shared Vibes account `AC8d5f68c0bde434a245c6b356550a0e17`
(where NONE of the Emerald resources exist — no Emerald messaging service, no RCS sender, no Flex).
The user then swapped to their own account credentials `AC6b1d68e06745b643d5e145e352eeb464`, which is
where everything Emerald lives. **If Emerald SIDs 404, check which account the chat is on first.**

**Symptom reported:** signup/Lookup/Verify/welcome RCS all worked, then tapping "Book a class" did
nothing. **Root cause:** the Emerald Fitness Messaging Service's `inbound_request_url` still pointed
at the OLD Railway host, so RCS button payloads were being delivered to the previous deployment.

Fixed this session (all on `AC6b1d68…`):
- Messaging Service `MG70925a5d4c282605f5f953f773c3c11a`: `InboundRequestUrl` →
  `<new host>/journey/inbound`, `StatusCallback` → `<new host>/journey/status`,
  `UseInboundWebhookOnNumber=false`.
- Phone number `PNbd992392196fc942be68c5e9c7648198` (**+18668144982**, "Emerald Fitness — West 7th",
  tollfree): `VoiceUrl` → `<new host>/twiml`; cleared a stale `StatusCallback` that pointed at
  `bpwilke-included-health-demo.vercel.app/api/voice/status` and a stale empty `SmsUrl`.
- Intelligence configuration `intelligence_configuration_01kz6x07amffhs89jt6v0m0vh3`: re-pointed both
  rules' webhooks to `<new host>/journey/cintel` by re-running `server/provision-cintel.cjs`
  (it derives `WEBHOOK_URL` from `TWILIO_VOICE_PUBLIC_DOMAIN`, which was already correct). Script is
  idempotent — reused the existing KB, source and all 3 operators; already attached to
  `conv_configuration_01kfy8k1k1fx0rfcsa6qcsns1c`.
- Env vars corrected: `TWILIO_PHONE_NUMBER`, `EMERALD_STUDIO_PHONE`, and a newly-added
  `NEXT_PUBLIC_EMERALD_STUDIO_PHONE` all → **+18668144982** (they had been carrying +18552592609,
  which is a number on the SHARED account, not the user's — so the UI was telling the room to call a
  number that doesn't exist on the connected account).
- Flex plugin: registered `FLEX_PLUGIN_VERSION` **1.1.1** (bumped in
  `server/src/flex-plugin/bundle.ts`) pointing at `<new host>/flex-plugin/emerald-member-context-1.1.1.js`.
  New Version `FV772aaec6deaad134c0c2ff970b678928`, Configuration `FJ51d6ed6bbd119ef5a79ca37156d6a26c`
  ("Emerald Member Context 1.1.1"), Release `FKcba294cb43a646760c4146f1fa4f437c`. The 1.1.0 version
  still pointed at the old host. **Gotcha: `POST /v1/PluginService/Configurations` requires `Name`
  (not `unique_name`/`FriendlyName`) — error 20001 otherwise.** `Plugins` is still a repeated param
  of single JSON objects, as documented in Session 16.
- `TWILIO_TWIML_APP_SID` is intentionally EMPTY and is fine — its only consumer is `/api/token` for
  the softphone in Live Demos, which is gated off by `SHOW_LIVE_DEMOS = false`.
- README gained a new "If this project was cloned" subsection listing the four webhooks to repoint.

**Checklist for any future clone of this project** (nothing in code needs changing — it's all Twilio
console/API state): Messaging Service inbound URL + status callback, phone number VoiceUrl, the
intelligence configuration webhook (just re-run provision-cintel.cjs), a fresh Flex plugin version
at the new host, and confirm `TWILIO_PHONE_NUMBER`/`EMERALD_STUDIO_PHONE` exist on the connected
account.

## Session 63 — Voice stream value facts fully replaced (all 4 stages)
User supplied verbatim replacement copy for `studioValue` + `bmsValue` on every Voice stage, with
citations for some bullets and explicit "(no citation)" on others.
- **`ValueList` in `MaturitySection.tsx`** gained a second citation branch: `citation && !href`
  now renders as a small plain `<span>` (`mt-1 block text-[11px] text-white/35`, no underline, not
  a link) instead of being silently dropped. Needed because the Advanced Analytics studio bullet
  cites "Gartner & Forrester Research" with NO url. Existing `citation && href` link branch
  unchanged, so Messaging-stream styling is untouched.
- **`voice-outbound`**: studio = 93% higher response rates (HubSpot, "State of Sales") + branded
  caller ID answer-rate/decline-rate/498% ROI bullet (FCC Triennial Report PDF). BMS = add-on
  revenue/ACV ($49–$99/mo per location, `sourced: true`, no citation) + enterprise competitive moat
  (plain string; "stickyness" corrected to "stickiness").
- **`voice-cintel`**: studio = auto-update BMS with disposition/post-call automations (plain) + 35%
  higher win rates (Landbase, "Go-to-Market Statistics 2026"). BMS = "Mariana Tek AI Smart
  Front-Desk" at $89/mo per location (`sourced: true`) + core data enrichment groundwork (plain;
  "simulatenously" corrected to "simultaneously").
- **`voice-inbound-routing`**: studio = one number for SMS + Voice, and staff efficiency/multi-studio
  overflow (both plain). BMS = "Business Operating System" 45–95% valuation premium (Windsor Drake,
  "Vertical SaaS Valuation Report Q4 2025") + GRR 88–92%/NRR 110%+/1.5–3x growth (ChartMogul, "SaaS
  Retention Report").
- **`voice-analytics`**: studio now has THREE bullets (existing churn-signal one kept verbatim, plus
  anonymized network benchmarking, plus the Gartner/Forrester decision-speed bullet with the
  url-less citation). BMS has THREE bullets: aggregated-data opportunities (plain, "MT provided"
  expanded to "Mariana Tek-provided"), the $99/mo × 1,000 accounts × 15% = $178k ARR module math
  (`sourced: true`), and peer-benchmark GRR 90%+/+25% adoption (ChartMogul again).
- Convention applied consistently with the Messaging stream: any uncited bullet containing a `/`%`
  /`Nx` figure is `{ text, sourced: true }` so `hasMetric()` doesn't slap a red `[source missing]`
  tag on copy the user deliberately supplied without a source.

## Session 62 — Citation swap on the 45% first-90-day retention bullet
- `msg-marketing.studioValue[0]` ("Boost new member retention by up to 45% during the critical
  first-90-day window…") citation changed from McKinsey "What Is Personalization?" to
  **Health & Fitness Association, "Why Your Gym Needs to Be a Community Center"**
  (`healthandfitness.org/why-your-gym-needs-to-be-a-community-center/`). The McKinsey
  personalization link now appears only on the second bullet (the 30–45% LTV one added in
  Session 61), so the stage no longer has two identical citations.

## Session 61 — Value for Barry's copy updates (Marketing SMS + Emerging Channels)
- `msg-marketing.studioValue`: replaced the plain-string bullet `'Higher lifetime value from
  targeted, permission-based win-back sends'` with a `sourced: true` bullet — "Boosting Member
  Retention & Lifetime Value (LTV): Personalized SMS re-engagement workflows drive 30% to 45%
  retention uplifts across active member cohorts." citing McKinsey "What Is Personalization?".
  Note this stage now has TWO McKinsey-personalization-cited bullets (the pre-existing 45%
  first-90-days one plus this) — that's intentional per the user's exact copy, not a duplication bug.
- `msg-emerging-channels.studioValue`: the McKinsey LTV bullet was REMOVED from here (its copy
  moved to Marketing SMS above), the existing "RCS achieves up to a 10x higher CTR" bullet was
  promoted to first position, and a new second bullet added — "Revenue & ROI Influence: … 115%
  increase in message-generated revenue, a 140% uptake in promotional offers, and up to 6.2x higher
  ROI …" citing "Google, RCS for Business — Success Stories"
  (`rcsforbusiness.google/resources/success-story/` with the user's full `#:~:text=` fragment
  preserved verbatim, same convention as the existing telco-deck link).
- Data-only change; no component/type changes needed (`ValueBullet`'s object form already supports
  citation + href).

## Session 60 — Executive Vision font consistency fix
User said the headline/subhead "looks different" from the rest of the page. Root cause: the
Session 59 rewrite had explicitly added `font-heading font-bold` to the h2 (every other section's
h2, e.g. `StorySection`, uses just `font-semibold` — `font-heading` was redundant/harmless since
`globals.css` already applies Poppins to all h1–h6, but the extra `font-bold` made it read
heavier/different) and had put the subhead in Poppins `font-semibold` (every other section's
supporting paragraph is a plain `<p>`, which inherits the body's Roboto font, at a normal weight).
Also the card headlines had `font-heading` added (Poppins) where the equivalent big-number stat
in `HeroSection`'s Industry Perspective cards has no `font-heading` (plain Roboto, just bold+color).
- `ExecutiveVisionSection.tsx`: h2 → `text-3xl md:text-5xl font-semibold leading-tight max-w-3xl`
  (dropped `font-heading`/`font-bold`, exactly matching `StorySection`'s h2). Subhead `<p>` →
  `mt-5 text-white/60 max-w-2xl text-base md:text-lg` (dropped `font-heading font-semibold`,
  matching `StorySection`'s intro paragraph pattern). Card headline `<div>` → dropped `font-heading`
  so it renders in Roboto like `HeroSection`'s metric numbers, keeping `text-2xl md:text-3xl
  font-bold text-mint`.

## Session 59 — Executive Vision restyled as 3 horizontal stat cards
- `src/lib/data/executive-vision.ts` rewritten: `executiveVisionHeadline` is now `{ main, sub }`
  (main = "You already ran this playbook with payments.", sub = "Communications is the second
  act." — rendered at two different sizes). Replaced the old 3 long-paragraph
  `executiveVisionPoints` with `executiveVisionCards` — concise `{ headline, subhead, citations? }`:
  card 1 "2–5× revenue per customer" (a16z), card 2 "+2–4 turns on the multiple" (733Park +
  Meritech, both kept), card 3 "Xplor builds the agent" / "Twilio handles everything between it
  and the customer" (no citation).
- `ExecutiveVisionSection.tsx` rewritten to a `grid md:grid-cols-3` of horizontal cards — big bold
  mint headline (`text-2xl md:text-3xl font-bold`), smaller regular subhead
  (`text-sm md:text-base text-white/60`), citations only on cards 1–2 in a much smaller
  (`text-[10px]`) dotted-underline link row below a divider — same small-citation visual pattern
  already used in `HeroSection`'s Industry Perspective cards.
- No new env vars/packages.

## Session 58 — New "Executive Vision" section (payments → communications framing)
- New `src/lib/data/executive-vision.ts`: `executiveVisionHeadline` + `executiveVisionPoints`
  (3 entries, `{ lead, body, citations?: {citation, href}[] }`). Point 1 cites a16z ("Fintech
  Scales Vertical SaaS"); point 2 cites BOTH 733Park and Meritech (two citations rendered
  side-by-side); point 3 (the "every AI dollar Xplor doesn't spend" line) intentionally has no
  citation — it's a strategic conclusion, not a sourced stat. User explicitly asked to drop the
  ✅/✏️ confidence-marker emojis from the original draft — plain italic underlined citation links
  only, same visual pattern as the Session 57 Opportunity stats card.
- New `src/components/showcase/ExecutiveVisionSection.tsx` — styled like `HeroSection`/
  `StorySection` (glow blobs, `font-heading font-bold` h2, mint eyebrow), renders each point as its
  own rounded card (bold lead-in inline with body text, citations appended at the end).
- Wired into `ShowcaseClient.tsx`: new nav entry `{ id: 'executive-vision', label: 'Executive
  Vision' }` and `<ExecutiveVisionSection />` inserted between `<HeroSection />` (Industry
  Perspective) and `<StorySection />` (The Opportunity) — exact placement the user asked for.
- No new env vars, no new packages.

## Session 57 — Sourced stats card added to The Opportunity section
- `src/lib/data/metrics.ts`: new `OpportunityStat` interface + `opportunityStats` export — 4
  entries (Menlo Ventures 76% bought-not-built, MIT NANDA ~95% no P&L return, RAND 2x IT project
  failure rate, Stanford HAI ~280x cheaper inference), each with a real `href` the user supplied
  (MIT NANDA links to the Fortune coverage article, per the user's exact list).
- `src/components/showcase/StorySection.tsx`: added a new card BELOW the existing 3-column story
  (Mariana Tek / Barry's / Member) — dark rounded card (`border-mint/25`, `bg-black/30`,
  `rounded-[28px]`), bold two-line heading "The market has already decided: for AI communications,
  build is the losing play." (h3, `font-heading font-bold`, matching the Poppins heading font
  already used site-wide via `globals.css`'s `h1–h6 { font-family: var(--font-poppins) }`), 2x2
  grid of bullets (mint dot marker + bold lead-in + regular body + italic underlined mint citation
  link, `target="_blank"`). Placement below the 3 columns was an explicit user correction to the
  original plan (which had proposed inserting it above).
- No new env vars, no new packages, no font change needed — the screenshot's rounded bold heading
  font was already exactly what `--font-poppins` renders at `font-bold`.

## Session 56 — Content overhaul: Marketing SMS, Emerging Channels, Omnichannel Conversations
Interpreted this batch the same way as the "Omnichannel Conversations" block in the request itself
demonstrated: bullets the user re-listed verbatim (e.g. "A single conversational data model...")
mean KEEP, bullets not re-listed at all mean DROP, and everything else is a full replacement of
that stage's `studioValue`/`bmsValue` array rather than an addition on top of it.

- **`msg-marketing.bmsValue`**: removed `'New usage-based revenue line from campaign send
  volume'` and `'Cleaner subscriber lists from native opt-in/opt-out compliance'` entirely — only
  the two Session-55 sourced NRR/GRR bullets remain.
- **`msg-emerging-channels`**: `studioValue` fully replaced — old "Higher click-through..."/
  "Unified global context..." bullets dropped, replaced with two new `sourced: true` + citation
  bullets: 30–45% retention uplift (McKinsey personalization) and RCS's ~10x CTR vs. SMS (Google's
  RCS Business Messaging telco deck PDF, kept the full URL including the `#:~:text=` fragment
  exactly as given). `bmsValue`: first bullet expanded from "Differentiated channel vs.
  competitors..." into the fuller "...RCS enables Mariana Tek to create a high-margin premium
  messaging add-on package ('Advanced Rich Messaging Tier') to drive NRR" (no citation given, plain
  string); second bullet ("Churn deflection...") re-listed verbatim by the user → kept unchanged.
- **`msg-omnichannel-conversations`**: `studioValue` fully replaced — old "Faster staff response —
  ... 'what is this about again?'"/"Lower infrastructure costs..." bullets dropped, replaced with
  reworded "Faster staff response, full context on screen - no more waiting for UI to update with
  new messages" and new "Seamless cross-channel support for front-desk staff across webchat, SMS,
  RCS, WhatsApp, and Facebook Messenger" (both plain strings, no metric/no citation). `bmsValue`:
  "A single conversational data model..." re-listed verbatim → kept; "Engineering opex savings from
  native push APIs..." dropped (not re-listed); added new `sourced: true` bullet on build-vs-buy
  maintenance cost (15–20%/year), citing "The Code" (thecodev.co.uk/build-vs-buy-framework/).
- All new citation links follow the `{ text, sourced: true, citation, href }` `ValueBullet` shape
  introduced in Session 55 — no further type/component changes needed this session, purely data.

User caught two things: the "Proves Clear ROI" bullet still showed `[source missing]` (it was left
as a plain string in Session 54, not actually marked `sourced`), and the three bullets that DID have
real source URLs only had them as code comments — never rendered anywhere. Asked to follow the same
citation pattern already used in `HeroSection.tsx`/`metrics.ts` (Industry Perspective cards: a small
dotted-underline link at the bottom, `citation` text + `href`, opens in a new tab, hover → mint).

- **`ValueBullet` type extended**: `string | { text: string; sourced: true; citation?: string;
  href?: string }`. Citation/href are optional — a bullet can be `sourced: true` with no visible
  link (e.g. "Proves Clear ROI" and "Maximized class yield", where no real source exists) or with
  one (the three that had real URLs).
- **Fixed the actual bug**: "Proves Clear ROI…" (`msg-alerts.bmsValue`) is now genuinely
  `{ text, sourced: true }` — previously it was left as a plain string despite Session 54's memory
  entry claiming otherwise, which is why the tag never went away.
- **Added real visible citations** (text styled/linked exactly like `HeroSection`'s citation
  pattern, just rendered inline under the bullet instead of at the bottom of a whole card) to the
  three bullets that have real sources:
  - `msg-marketing.studioValue` retention bullet → "McKinsey & Company, 'What Is
    Personalization?' McKinsey Explainers" → mckinsey.com/featured-insights/mckinsey-explainers/what-is-personalization
  - `msg-marketing.bmsValue` NRR/ARPU bullet → "McKinsey & Company, 'The Net Revenue Retention
    Advantage: Driving Success in B2B Tech'" → mckinsey.com/.../the-net-revenue-retention-advantage-driving-success-in-b2b-tech
  - `msg-marketing.bmsValue` GRR/churn bullet → "Subjolt, 'NRR & GRR Benchmarks' Guide" →
    subjolt.com/guides/nrr-grr-benchmarks/
  - Deliberately did NOT fabricate a publish year for any of these three — none was given, and the
    Jabarian/Henkel citation format the user pointed to as a template includes a year only because
    that source actually has one; inventing one here would be a fabricated detail.
- **`ValueList` in `MaturitySection.tsx`** now renders `item.citation` as an `<a>` (when both
  `citation` and `href` are present) directly under the bullet text — same visual treatment as
  `HeroSection`'s citation links (`text-white/35`, dotted underline, `hover:text-mint`,
  `target="_blank"`), just block-level under the bullet instead of pinned to a card's bottom edge.

User gave specific remove/add/reword instructions for two stages' value bullets, plus real citation
URLs for some of the new ones — needed a way to mark a bullet as legitimately sourced (or just an
explicitly-labeled average) so it does NOT get the automatic `[source missing]` tag that
`hasMetric()` triggers on any `%`/`# Project Memory
/`Nx` figure.

- **New `ValueBullet` type** in `maturity.ts`: `string | { text: string; sourced: true }`. Plain
  strings behave exactly as before (auto-flagged if they contain a quantified claim). The object
  form is used for anything either explicitly labeled as an average/estimate, or backed by a real
  citation — citation URLs are kept as code comments next to each entry (no visible link in the
  UI, consistent with how the rest of the app treats sourcing — just presence/absence of the flag).
  `StreamStage`/`FlexShortcut`'s `studioValue`/`bmsValue` fields changed from `string[]` to
  `ValueBullet[]`.
- **`ValueList` in `MaturitySection.tsx`** updated to unwrap either shape and only run
  `hasMetric()` (and thus render `<SourceMissing />`) when the bullet is a plain string — object
  bullets with `sourced: true` never get the tag regardless of content.
- **`msg-alerts` (Alerts & Notifications)**: removed `'Lower DSO — failed billing recovered...'`
  from `studioValue` entirely; kept `'Maximized class yield — recovers up to $36...'` but marked
  `sourced: true` (it's explicitly an average, not an unverified claim). `bmsValue` had BOTH
  original bullets removed (`'Metered overage recovery...'` and `'Support cost reduction...'`) and
  replaced with a single new bullet: `'Proves Clear ROI: Demonstrating a direct $17,000+ annual
  revenue recovery proves a 10x+ ROI on Mariana Tek's software fee ($200–$350/month), reducing
  platform churn.'` — left as a plain string (no citation given for this one, so it still gets
  auto-flagged, which is correct/expected).
- **`msg-marketing` (Marketing SMS)**: `studioValue[0]` reworded to "Boost new member retention by
  up to 45%..." and marked sourced (McKinsey personalization article). Added two new `sourced: true`
  bullets to `bmsValue` — NRR/ARPU expansion (McKinsey NRR-in-B2B-tech article) and GRR/churn
  reduction via workflow embeddedness (Subjolt NRR/GRR benchmarks guide) — both additive, existing
  `bmsValue` bullets were NOT removed since the user didn't ask for that.

Added "Automate Upsells & Class Management" ("Reschedule classes and run powerful RCS and SMS
upsell campaigns.") as a second use case under `ai-messaging-hookup` in `maturity.ts` — that stage
previously had only one use case, so its detail panel's "Use cases in action" grid now shows two
cards side by side like every other stage.

Updated the `voice-cintel` stage description in `maturity.ts` to broaden scope beyond outbound-only
("every call" instead of "every outbound call") and add real-time intent analysis, lead scoring,
next-best-action suggestions, and churn-signal flagging to the copy — verbatim text supplied by the
user.

Session 50's `w-40` → `w-44` tile widening (done to give the longer renamed tiles more breathing
room) pushed the 4-tile row width from ~796px to ~860px, which exceeded the ~832px actually
available in the lanes column once the 600px Flex SDK panel + gap is showing — so the last tile in
EVERY lane wrapped onto its own row. That silently broke every geometry assumption the perimeter
effect depends on (it assumes Omni/Ai's "tile 4" sits at the right end of a single-row lane, and
that Voice's lane bounding box is exactly one row tall) — with tile 4 wrapped to a lone second row,
`voiceLaneRef`'s measured box became enormous (spanning both rows, full lane width) and Omni/Ai's
boxes ended up positioned at the far-left instead of near Voice's right edge, producing the huge
malformed blob shown in the bug report.
- **Fix**: reverted tile width back to `w-40`. The actual ask ("don't cut text off") was already
  fully solved in Session 50 by removing `line-clamp-2`/`line-clamp-1` — text now wraps to as many
  lines as it needs and is never truncated, regardless of tile width. The width increase was an
  unnecessary extra change that had a much bigger blast radius than intended; reverting it restores
  the single-row layout (and the resulting sane one-row-tall Voice bounding box) while text still
  never gets clipped.
- Lesson for later: any future width tweak to these tiles needs to be checked against the
  available lanes-column width while Flex SDK mode is on (~832px at max-w-[100rem] with a 600px
  panel + 40px gap), not just how it looks in DIY mode — the two modes have very different budgets.

- **Renames in `maturity.ts`** (name field only, ids/taglines/descriptions/useCases/values
  untouched, so all cross-references by id stay valid): `ai-messaging-hookup` "Agent Hookup" →
  **"Text-Based Agentic Flows"**; `voice-cintel` "+ CINTEL & Dispositions" → **"Conversational
  Intelligence & Automations"**; `voice-inbound-routing` "Unified Inbound & Outbound Voice
  Platform" → **"Unified Inbound & Outbound Voice"** (dropped "Platform"); `ai-voice-joins` "Voice
  AI Joins In" → **"Autonomous Voice AI"**; `ai-unified` "Unified Omnichannel Agent" →
  **"Intelligent Multi-Channel Self-Service & Handoff"** (by far the longest tile name in the app
  now, 49 chars).
- **Root cause of the clipping**: `renderTile` had `line-clamp-2` on the name and `line-clamp-1`
  on the tagline, sized for short 2-3 word names — "Enterprise Knowledge, Memory & Intelligence"
  (44 chars) and now "Intelligent Multi-Channel Self-Service & Handoff" (49 chars) need 3+ lines at
  that width/font-size, so line-clamp-2 truncated them with an ellipsis mid-word.
- **Fix**: removed `line-clamp-2`/`line-clamp-1` entirely from both the name `<h3>` and tagline
  `<p>` — text now wraps to however many lines it needs, never truncates, and tiles simply grow
  taller to fit (no fixed height was ever set on the tile `div`, so this is a free change with no
  layout side effects elsewhere). Also widened tiles from `w-40` (160px) to `w-44` (176px) to keep
  line counts reasonable for the two longest names.
- Updated the one live prose reference to the old names in `README.md`'s Adoption Arch bullet, and
  refreshed `package.json`'s description (still said "Unified Omnichannel Agent").

User didn't want the auto-flag on the Branded Outbound Outreach stats. Reverted Session 48's
`hasMetric(uc.description) && <SourceMissing />` addition in the "Use cases in action" card
renderer back to plain `{uc.description}` — use-case card text no longer gets the `[source
missing]` treatment at all (that convention still applies only to the Value-for-Studio/BMS
`ValueList` bullets, as it always did before Session 48). `hasMetric`/`SourceMissing` imports are
still used there, so no import cleanup was needed.

Added the two user-provided stats to the "Branded Outbound Outreach" use case under Voice's
Outbound Calling stage: "72% of consumers never answer calls from unknown or unverified numbers,
while 78% are willing to answer when caller ID shows a recognized business name and logo" — appended
to the existing description in `maturity.ts` rather than as a separate element, keeping it "small."
Also extended the "Use cases in action" card renderer in `MaturitySection.tsx` to run `hasMetric()`
on `uc.description` and append the existing `<SourceMissing />` `[source missing]` tag when a
use-case description contains a quantified claim — previously that convention only applied to the
Value-for-Studio/Value-for-BMS bullet lists (`ValueList`), not use-case card text. This makes the two
new stats display the same `[source missing]` flag already used everywhere else on unsourced
numbers, and will automatically apply to any future use-case description with a `%`/`# Project Memory
/`Nx` figure
too, not just this one.

- **Sharp top-left corner on Voice**: `roundedPolyline` deliberately never rounds `points[0]` or
  `points[last]` (the loop only iterates interior indices). Session 46's waypoint array happened to
  start/end exactly at Voice's top-left corner, so that ONE corner never got rounded while every
  other corner did. Fix: rotated the waypoint array so it starts/ends at the MIDPOINT of Voice's
  left edge (`leftMidY = (V.y1+V.y2)/2`) instead — a point in the middle of a straight run, not an
  actual corner — so every real corner (Voice top-left included) is now an interior point and
  rounds identically. General lesson for any future closed-loop path built this way: never let the
  array's seam land on a real corner.
- **Right-edge "pop out" near Advanced Analytics & Automations**: the right edges of the Omni tile
  box, the whole Voice lane box, and the Ai tile box were each computed independently from their
  own measured `getBoundingClientRect()`, and were off from each other by a few px — enough for the
  rounded-corner logic to render a visible little jog where the path crossed from one box's right
  edge to another's. Fixed by computing `rightX = Math.max(rawO.x2, rawV.x2, rawA.x2)` once and
  overriding all three boxes' `x2` to that single shared value before building the waypoints — the
  entire right-hand side of the outline is now guaranteed to be one perfectly straight vertical
  line regardless of sub-pixel measurement differences between the three source elements.
- Both fixes are localized to the waypoint-construction code in `MaturitySection.tsx`'s perimeter
  effect — no ref/layout/data changes this session.
- Also refreshed `package.json`'s `description` field, which had gone stale since Session 40 (it
  still described the old dotted-AI-pairing/dashed-Flex-bridge design that was removed several
  sessions ago) — now describes the DIY/Flex SDK toggle and the single continuous envelope.

User picked "Option B" from the two choices offered: a true single continuous outline rather than
3 separate rects joined by wire-like lines, PLUS the Voice envelope needed to extend higher so it
stops cutting into the "VOICE STREAM" label.

- **`voiceLaneRef` now points at the WHOLE Voice lane wrapper** (label div + tile row together,
  the outer `<div key={stream.id}>` in `renderLane`) instead of just the tile row — so the Voice
  region's bounding box naturally starts above its own label with real clearance, no special-case
  math needed. Only Voice gets this treatment (its "envelop the entire stream" requirement already
  implied including the label); Omni and Ai stay tile-only, matching the original ask that only
  those two specific tiles (not their whole lane) are enveloped.
- **One non-self-intersecting closed path, 17 waypoints**, replacing the 3-rect-plus-bridge-lines
  design from Session 45. Derived the shape by reasoning about the real union geometry: since Omni
  and Ai are single "4th tile" boxes and, given `justify-start` layout, all three lanes' 4th tiles
  land at nearly the same right-edge x (same tile width/gap/arrow pattern repeated 4×), Omni's and
  Ai's boxes sit almost flush with Voice's own right edge — meaning the "bridges" up to Omni and
  down to Ai are actually narrow tabs off Voice's right portion, not centered notches. Path order
  (clockwise from Voice's top-left): across Voice's top edge to Omni's bridge → up around Omni (all
  4 sides) → back down onto Voice's top edge → down Voice's right edge → across Voice's bottom to
  Ai's bridge → down around Ai (all 4 sides) → back up onto Voice's bottom edge → left along Voice's
  bottom edge back to its bottom-left → up Voice's left edge, closing the loop. This traces every
  edge of all three regions explicitly (not implied/topological like Session 43's version), so it
  reads as one genuinely uniform envelope rather than "boxes with gaps in their outline."
  Re-introduced the `Point`/`roundedPolyline` helper (removed in Session 45) since a single path
  with many waypoints is back — default `radius` bumped 18→20 to match the halo `rx` value Session
  45 had settled on, keeping corner roundness consistent with that round's "uniform" feedback.
  - Skipped adding back an `aiLabelRef`/label-avoidance midpoint for the Voice→Ai corridor — that
    corridor is now a plain vertical line positioned at Ai's own (far-right) x, while AI's label
    text starts at the far-left of its row, so they don't realistically overlap; flagged in-chat as
    an easy follow-up if it turns out to clash in practice.
- `PerimeterGeometry` simplified to `{ path: string; flexLine: Line }` — dropped the `Box`
  interface (no longer needed, everything folds into path waypoints now) but kept `Line` for the
  independent Flex connector, which is UNCHANGED from Session 45: a single straight line from
  Voice's right edge at its own vertical center, straight to the Flex card's left edge — this was
  explicitly NOT rolled back, since that part of Session 45's design was already correct.
- Rendering: one `<g>` sets `stroke`/`strokeWidth`/`strokeLinecap`/`strokeLinejoin` once (inherited
  by both children); the `<path>` carries its own `fill="rgba(236,253,145,0.03)"` (the line has no
  fill, so no need to guard against inheritance there).
- `README.md` Adoption Arch bullet rewritten to describe the single continuous outline.

User marked up a screenshot with red lines showing the desired shape: instead of one continuous
winding outline that hugs every contour, three independent, visually IDENTICAL rounded rectangles
(around Omnichannel Conversations, the whole Voice Stream, and Unified Omnichannel Agent) linked by
plain straight vertical lines, plus a single straight horizontal line from the CENTER of the
(middle) Voice Stream box out to the Flex SDK card — not two separate lines converging on the card.

- **Completely replaced the `roundedPolyline`/single-`<path>` approach** with plain SVG primitives:
  `<rect x y width height rx>` for each of the 3 halos (same `rx={20}` on all three — the literal
  "much more clean and uniform" ask) and `<line>` for the 2 inter-box bridges + the 1 Flex
  connector. Removed the `roundedPolyline` helper and the `Point` interface entirely — no longer
  needed now that every segment is either a rect or a straight line. New `Box`/`Line`/
  `PerimeterGeometry` interfaces replace the old flat path-string state
  (`perimeterPath: string | null` → `perimeter: PerimeterGeometry | null`).
- **Geometry is now much simpler to reason about**: `boxFrom(rect)` inflates a measured
  DOMRect-derived box by `PERIMETER_MARGIN` on all sides — the SAME helper used for all three
  regions (omni tile, voice row, ai tile), guaranteeing uniform margin everywhere. `bridge1` runs
  straight down from `omniBox`'s horizontal center to `voiceBox`'s top; `bridge2` straight down
  from `aiBox`'s horizontal center up to... i.e. from `voiceBox`'s bottom to `aiBox`'s top, at
  `aiBox`'s horizontal center. `flexLine` runs straight right from `voiceBox`'s right edge, at
  `voiceBox`'s VERTICAL center, to `flex.left` — this is what makes it read as "one simple line
  from the center of the Voice Stream," replacing the old two-line convergence-on-the-card design.
  All three are rendered inside one `<g className="sunray-perimeter-glow" fill=... stroke=...>` so
  the color/glow is set once and inherited by every child, guaranteeing they all look identical
  (also literally serves "uniform").
- Since bridges are now single straight lines (not the old jog-around-the-label-text routing), the
  `voiceLabelRef`/`aiLabelRef` refs and the `midY1`/`midY2` label-avoidance math from Session 44
  were no longer needed and were removed — the `space-y-16` lane spacing (kept from Session 44)
  already gives enough clearance in practice since a 2.5px straight line is far less likely to
  visually clash with text than the old wider winding path was.
- Fill kept subtle (`rgba(236,253,145,0.03)`, close to Session 44's already-reduced value) and
  applied per-box via the shared `<g>` rather than one big irregular enclosed region — since each
  box is now independently and identically styled, this should read as more visually uniform too,
  not just less "washed out."
- `README.md` Adoption Arch bullet rewritten to describe the halo+connector shape.

Four fixes on the Session 43 perimeter feature, all from a single screenshot-annotated report.

- **Anchor point**: both loop endpoints changed from the Flex card's INTERIOR center
  (`{(flex.left+flex.right)/2, (flex.top+flex.bottom)/2}`) to the midpoint of its LEFT EDGE
  (`{flex.left, (flex.top+flex.bottom)/2}`) — previously the two connecting lines cut diagonally
  across the card's own text (visible in the user's screenshot slicing through "Embedded
  Cancellation Flow"); now both lines converge to a single point sitting exactly on the card's
  left border, reading as one clean "V" instead of an "X" through the content.
- **Spacing/crossing-line position**: root cause of lines overlapping the "VOICE STREAM"/"AI
  STREAM" labels was twofold — (1) the old `midY` used `voiceRow.top` (top of the TILE row) instead
  of the label's top, and a fixed `voiceRow.bottom + margin` (not a midpoint at all) for the
  voice→AI crossing; (2) the actual gap wasn't generous enough. Fixed by: bumping lane spacing
  `space-y-10` → `space-y-16`; adding `voiceLabelRef`/`aiLabelRef` (attached to each lane's label
  div, distinct from the existing tile-row refs); replacing the single `midY` with two proper
  midpoints — `midY1 = (omni.bottom + voiceLabel.top) / 2` and
  `midY2 = (voiceRow.bottom + aiLabel.top) / 2` — literally "halfway between the top of the stream
  text and the bottom of the boxes" per the ask. This also means the voice-envelope's vertical
  extent now runs from midY1 to midY2 (properly bracketing the whole row with margin on both
  sides) instead of stopping right at the tile edges.
  - **Ref-callback lint gotcha (new)**: tried threading `labelRef`/`rowRef` into `renderLane` as an
    `opts` object holding inline arrow-function ref callbacks (`labelRef: (el) => { ref.current =
    el }}`) — hit a hard compiler error "Cannot access refs during render" / `react-hooks/refs`,
    because the linter's static analysis only recognizes a ref callback as commit-time-only when
    it's passed directly as a JSX `ref={...}` prop, not when threaded through an arbitrary custom
    prop first. Fixed by going back to the already-proven pattern from Session 43: pass the
    `useRef` object itself directly via a ternary keyed on `stream.id` right at the JSX `ref={...}`
    attribute inside `renderLane` (no intermediate `opts` object, no callback wrapper) —
    `ref={stream.id === 'voice' ? voiceLabelRef : stream.id === 'ai' ? aiLabelRef : undefined}`.
- **Tint opacity**: fill dropped from `rgba(236,253,145,0.045)` → `rgba(236,253,145,0.02)` — the
  higher value was visibly washing the Voice Stream tiles yellow-green in the screenshot (the SVG
  paints behind the tiles, so its fill shows through their translucent `bg-white/5` backgrounds).
- **Resize robustness ("becomes fixed/stuck")**: diagnosed as the combination of (a) a
  `window resize`-only listener, which can read mid-reflow and never gets a clean follow-up once
  things settle, and (b) the `transition-[max-width] duration-300` added in Session 43, which meant
  there was sometimes an actively-animating width to measure against. Fixed by: removing the
  max-width CSS transition entirely (instant width change again — consistent with the project's
  established "instant" preference anyway); adding a `ResizeObserver` on `surfaceRef` itself
  (fires on the element's actual rendered size changing, which is what we care about — more
  reliable than viewport `resize` for catching flex-wrap reflow) alongside the existing window
  listener; wrapping every measurement in `requestAnimationFrame` via a `scheduleUpdate()` helper
  so reads always happen after the browser has committed layout for that frame, with
  `cancelAnimationFrame` cleanup to avoid stacking stale frames during rapid resize.
- All four fixes are localized to `MaturitySection.tsx`'s perimeter effect, `renderLane`, and the
  surface wrapper's className — no data file changes this session.

Three asks: (1) DIY mode should look centered like before the toggle existed, expanding into the
wide left-shifted layout only when Flex SDK turns on; (2) the headline/intro/legend block should
stay at a fixed centered width in BOTH modes, never stretching; (3) a glowing yellow perimeter that
visually encircles "what Flex SDK includes" — traced from the Flex SDK card, around the top+left of
Omnichannel Conversations, fully around the Voice Stream, around the left+bottom of Unified
Omnichannel Agent, and back to the Flex SDK card.

- **Centering (`MaturitySection.tsx`)**: the header wrapper (`<div>` holding the h2/paragraph/legend)
  is back to a permanent `max-w-6xl mx-auto` — no longer tied to the toggle at all. The lanes+panel
  wrapper's max-width is now `mode === 'flex' ? 'max-w-[100rem]' : 'max-w-6xl'` with a
  `transition-[max-width] duration-300` so it visibly "expands" rather than jump-cutting (the
  earlier "instant show/hide" preference was specifically about the Flex card's own mount/unmount,
  not this width change, so a width transition felt like the right read of "expand the surface").
  `renderLane`'s tile row also switched from a hardcoded `justify-start` back to a `mode`-driven
  `justify-start` (flex) vs `justify-center` (DIY) — so tiles genuinely re-center themselves when
  the toggle flips back, matching how the page looked before the toggle feature existed.
- **The perimeter path** — re-derived the exact `roundedPolyline(points, radius)` helper from the
  pre-Session-33 connector system (same waypoint-rounding algorithm; a straight line is drawn L→Q
  rounded-corner→L per interior waypoint) since it was proven and this shape is a natural fit for it.
  New refs: `surfaceRef` (the lanes+panel wrapper — coordinate origin for all relative math),
  `flexCardRef` (the Flex SDK card), `omniTileRef` (attached inside `renderTile` when
  `stream.id === 'messaging' && stage.id === 'msg-omnichannel-conversations'`), `voiceRowRef`
  (attached to the Voice lane's tile-row div specifically, not its label header), `aiLastTileRef`
  (attached when `stream.id === 'ai' && stage.id === 'ai-unified'`).
  - 10-point closed loop (first/last point both = the Flex card's own center, so the polyline reads
    as a closed shape without needing separate closed-loop corner math): flex-center → above
    omni-tile's right → above omni-tile's left ("circles the top") → down to a midpoint between
    omni's bottom and the voice row's top → jog left to the voice row's actual left edge → straight
    down to below the voice row (this + the previous jog is what "envelopes the entire Voice
    Stream" — topologically, everything between messaging's row and the ai-tile sits inside this
    loop even though only its left+bottom edges are explicitly traced) → right along the bottom to
    align with the ai-tile's left edge → down past the ai-tile → across its bottom → back to
    flex-center. `PERIMETER_MARGIN = 16` (halo padding around each hugged edge).
  - **Only computed/rendered when `mode === 'flex'` AND `window.innerWidth >= 1024`** (Tailwind's
    `lg` breakpoint) — below that, `justify-start` layout doesn't even apply and tiles wrap
    differently, so the shape wouldn't be meaningful; gated both in the compute effect (bails to
    `null`) and the render (`hidden lg:block` on the `<svg>` itself, belt-and-braces).
  - Style: `stroke="#ecfd91"` (sunray) at `strokeWidth={2.5}`, `fill="rgba(236,253,145,0.045)"` for
    the "subtle background tint" ask, and a new `.sunray-perimeter-glow` CSS class (drop-shadow
    pulse, same color/alpha progression feel as the existing `.shortcut-glow` used on the Flex
    card's own border) so the line visually matches the card it originates from, per the "closely
    match the perimeter of the Embedded Flex SDK surface" instruction.
  - **React Compiler gotcha (new, distinct from the earlier `react-hooks/set-state-in-effect` ESLint
    warning)**: a synchronous `setState` inside a `useLayoutEffect` body throws a HARD compiler
    ERROR ("Calling setState synchronously within an effect can trigger cascading renders") that
    `// eslint-disable-next-line` does **not** suppress — unlike the equivalent pattern in a plain
    `useEffect`, which only produces a soft, disable-able ESLint warning. Fixed by using `useEffect`
    instead of `useLayoutEffect` for the perimeter computation (accepts a theoretically possible
    one-frame flash on first mount into Flex mode, not noticeable in practice). Removed the now-
    unused `useLayoutEffect` import.
- `globals.css`: added `sunray-perimeter-glow` keyframe + class.
- `README.md` Adoption Arch bullet rewritten to describe the centering behavior and the perimeter.

User feedback on Session 41's toggle: the lanes got visibly squeezed when the side panel appeared,
there was too much unused margin on the page to justify that, and having a separate small trigger
card that opens a detail box was redundant now that switching to Flex SDK already auto-opened it —
simpler to just have ONE always-fully-expanded card.

- **Removed the "flex" concept from `selectedKey` entirely.** `selectedKey` now only ever holds a
  stage key (`${streamId}--${stageId}`) or `null` — there is no more open/closed interaction state
  for the Flex SDK card. `DetailData` dropped its `kind: 'stage' | 'flex'` field and all the
  `activeDetail.kind === 'flex' ? ... : ...` ternaries throughout the stage detail panel (badge text,
  CTA, prev/next) — that panel is now unconditionally stage-only code, much simpler to read.
- **The Flex SDK card in the right column is now driven purely by `mode`** (`{mode === 'flex' &&
  (...)}`) and reads straight from the `flexShortcut` data object — no `activeDetail`, no click
  handler to open/close it, no "click for details" affordance. It renders fully expanded (use cases,
  value columns, tech stack, CTA) the instant you flip the toggle, and its own ✕ button calls
  `setMode('diy')` directly (closing IS switching back to DIY, there's no in-between state anymore).
  Content markup was adapted from the old shared stage-detail panel but resized for a ~600px column:
  `sm:grid-cols-2` (not `md:`) for the use-case/value grids, tighter padding, `text-sm` description.
- **Un-squeezing the lanes**: root cause was the whole row (lanes + panel) sharing the page's normal
  `max-w-6xl`, so the 600px-wide panel had to eat directly into the lanes' width. Both the intro
  block and the lanes+panel row now use `max-w-[100rem]` (1600px) instead of `max-w-6xl` — wide
  enough that a 4-tile row (~800px) plus a 600px panel plus gap fits without any wrapping penalty.
  Deliberately did NOT widen the stage-detail panel below (`max-w-6xl` there, unchanged) or any other
  section on the page — only this section's top two containers changed.
- **"Slide the lanes to the left"**: each lane's tile row changed from `justify-center` to
  `justify-start` — previously centering wasted space on both sides of a wrapped row; left-aligning
  reads more naturally now that the row has its own generous width and a right-hand neighbor.
- **Deep-linking simplified accordingly**: `#maturity-flex` now just calls `setMode('flex')` (no
  `selectedKey` involved at all for Flex); `#maturity-<streamId>--<stageId>` still calls
  `setSelectedKey`. The hash-sync effect now depends on `[selectedKey, mode]` and prioritizes
  `mode === 'flex'` → `#maturity-flex` over any stale `selectedKey`.
- **Lint gotcha (repeat pattern, different line)**: `react-hooks/set-state-in-effect` only flags the
  FIRST `setState` call actually reached in an effect body, not literally the first line of code —
  moving `setMode('flex')` into an `if` branch ABOVE the pre-existing `setSelectedKey` `else` branch
  moved which one needed the `eslint-disable-next-line` comment. Had to relocate the disable comment
  twice (guided by which line the build error's `Unused eslint-disable directive` warning pointed at)
  before both branches were clean.
- Also hit the known transient webcontainer `Cannot find module for page: /api/segment-profile`
  build error once — unrelated to this change, resolved on a clean re-run (documented gotcha from
  Session 5, still holds).
- `README.md` Adoption Arch bullet rewritten: no more "click to open" language for the Flex SDK
  card, mentions the wider lane layout.

Planned via a back-and-forth discussion turn first (user explicitly asked for suggestions before
implementing) — asked 4 clarifying questions, user answered all 4, then this was built exactly per
those answers: (1) pill/segmented toggle, slightly bigger than the 11px legend text; (2) rename the
tile "Embedded Omnichannel Architecture" → "Embedded Flex SDK" to match the toggle label; (3) instant
show/hide, no transition; (4) switching to Flex SDK auto-opens its detail panel immediately.

- **`maturity.ts`**: `flexShortcut.name` renamed `'Embedded Omnichannel Architecture'` →
  `'Embedded Flex SDK'`. Confirmed via search this string appears nowhere else in current code
  (only in MEMORY.md history, which is fine to leave as-is).
- **`MaturitySection.tsx`**:
  - New `mode` state (`'diy' | 'flex'`, default `'diy'`) alongside the existing `selectedKey`.
  - New `handleModeChange(next)`: sets `mode`, AND auto-selects `'flex'` when switching to Flex SDK
    mode (`setSelectedKey('flex')`), AND clears the selection when switching back to DIY **only if**
    `selectedKey === 'flex'` (so switching modes never clobbers an unrelated open stage-tile detail —
    only the Flex detail is coupled to mode).
  - Toggle UI: a pill container (`rounded-full border border-white/15 bg-white/[0.04] p-1`) with two
    buttons at `text-[13px]` (legend text is `text-[11px]`, so it reads as slightly bigger without
    dominating), placed with `ml-auto` inside the existing legend `flex flex-wrap` row so it sits at
    the far right of the "typically follows, within a stream" row on wide screens and wraps below on
    narrow ones. Active DIY = `bg-white/12 text-starwhite`; active Flex SDK = `bg-sunray/20
    text-sunray` (ties the color to the same sunray accent used everywhere else for Flex).
  - **Layout restructure**: the lanes container changed from a single `space-y-10` column to
    `flex flex-col lg:flex-row gap-8 lg:gap-6 items-start` — lanes live in a `flex-1 min-w-0
    space-y-10` div on the left; the Flex SDK card is now `w-full lg:w-72 shrink-0` on the right,
    and is **conditionally rendered entirely** (`{mode === 'flex' && (...)}`) rather than always
    mounted — satisfies "instant show/hide" (no exit animation, no `display:none` toggling, just
    mount/unmount) and "hides and removes" from the prompt. Below `lg` it naturally stacks under the
    lanes since it's a flex-col at that breakpoint. Deliberately kept the section's `max-w-6xl` (same
    as every other section on the page) rather than widening it — the new side panel fits inside that
    existing width instead of growing the section, so this section's edges still line up with Hero/
    Story/Capabilities etc. when scrolling.
  - The Flex SDK card itself was restyled from the old wide layout (icon+name+tagline in one row) to
    a narrower vertical layout (icon+name stacked with tagline below) to read well at ~288px.
  - **Deep-link fix**: the mount-time hash-read effect (`#maturity-flex`) now also calls
    `setMode('flex')` when the matched key is `'flex'` — without this, a direct link to the Flex
    detail would show the detail panel with the toggle still showing DIY and no visible side panel to
    have "caused" it, which would look broken.
  - Bottom hint text now reads `Click any stage${mode === 'flex' ? ' or the Flex SDK shortcut' : ''}
  to see its full breakdown` — only mentions the shortcut when it's actually on screen.
- `README.md` Adoption Arch bullet rewritten to describe the toggle, default state, and side-panel
  behavior.

User asked for a big simplification pass: swap the Voice/AI lane order, swap Messaging stages 3&4
(Emerging Channels now before Omnichannel Conversations), and remove every "bridge" concept entirely
— both the inter-stream connectors (AI junctions, the yellow cross-stream bridge) AND the Flex
Shortcut's 3 "lands directly on X" boxes.

- **Lane order** is now **Messaging → Voice → AI** (top to bottom) in `MaturitySection.tsx`'s JSX
  (`{renderLane(messaging)} {renderLane(voice)} {renderLane(ai)}`) — was Messaging → AI → Voice.
  Note: the `streams` array order in `maturity.ts` was never actually what controlled rendering
  order (the component always destructured `messaging`/`voice`/`ai` individually via
  `streamById.get(...)` and rendered them in an explicit hardcoded sequence) — only the JSX call
  order needed to change.
- **Messaging stage order swapped**: `msg-emerging-channels` (RCS/WhatsApp/FBM) is now stage 3,
  `msg-omnichannel-conversations` (Conversations API thread) is now stage 4. Rewrote both
  descriptions so the narrative direction still reads correctly with channels-first-then-unify
  instead of the old unify-first-then-add-channels: Emerging Channels no longer says "join the
  thread built in the previous stage" (there's no thread yet at that point now); Omnichannel
  Conversations now says "Every channel used so far — SMS, RCS, WhatsApp, and Facebook Messenger —
  comes together in one persistent thread", i.e. it's now explicitly the unifying CAPSTONE stage
  instead of the foundation stage. This is actually a cleaner maturity arc (add reach, then unify)
  than the previous ordering.
- **Full removal of cross-stream connectors** — this was the big structural change:
  - `maturity.ts`: deleted `AiJunction` interface + `aiJunctions` export, `CrossStreamBridge`
    interface + `crossStreamBridges` export, `FlexBridge` interface + the `bridges` field on
    `FlexShortcut` (and the 3-entry array on the `flexShortcut` object). File is now noticeably
    shorter and has only 3 exported concepts: `streams`, `flexShortcut` (bridge-free), and the
    stage/stream interfaces.
  - `MaturitySection.tsx` — rewritten (not just edited) to drop: `GutterConnector` component
    entirely, `messagingAiGutter`/`aiVoiceGutter`/`messagingVoiceBridgeGutters` memos, all badge
    helpers (`junctionBadge`, `aiOutgoingBadges`, `flexBadge`, `streamBridgeBadge`), the `⋯`/`🌉`/`⚡`
    corner-glyph rendering block on tiles, the `crossRefs` memo + its chip row in the details panel,
    the `bridgeHoverKey` state + `sunray-target-pulse` highlight wiring, and the Flex card's
    3-bridge-card grid (mini progress bars + "Lands directly on X" + "Skips N stages"). What
    remains on the Flex card: just the "⚡ THE SHORTCUT" eyebrow, icon, name, and `flexShortcut.tagline`
    as a one-line description — clicking it still opens the full detail panel (use cases, value
    columns, tech stack) exactly like any stage tile.
  - Legend row simplified to just the 3 stream color dots + the "typically follows, within a
    stream" solid-line entry — removed the dotted-mint (AI pairing), dotted-sunray (cross-stream
    bridge), and dashed-sunray (Flex shortcut) legend entries since none of those visual elements
    exist anymore.
  - `flexShortcut.tagline` reworded from "one integration, three shortcuts" → "embedded natively,
    without walking every stop" (no longer references specific bridge targets). `description`
    reworded to drop "lands a studio on the advanced end-stage milestone of ALL THREE streams" in
    favor of a generic "gives a studio native omnichannel communication controls... in one
    integration, instead of building up each stream stage by stage."
  - `globals.css`'s `sunray-target-pulse` keyframe is now dead/unused CSS (harmless, left in place
    per the no-`rm`-tool constraint and in case a future session wants a similar highlight effect
    again).
- Net effect: build size dropped (~76.5kB → ~74.2kB page bundle) from removing all the connector/
  gutter/badge logic — confirms the removal was clean, nothing else depended on those exports.
- `README.md` Adoption Arch bullet rewritten to describe the new lane/stage order and explicitly
  state "no visual connectors are drawn between the streams or from the shortcut into them."

User asked to swap AI stages 1 & 2, simplify "Messaging → Agent Hookup" to just "Agent Hookup", and
rename "Enterprise Knowledge & Memory" to "Enterprise Knowledge, Memory & Intelligence".

- **`maturity.ts`**: AI stream stage order is now `ai-knowledge-memory` (now FIRST) →
  `ai-messaging-hookup` (now SECOND, name simplified to just "Agent Hookup") → `ai-voice-joins` →
  `ai-unified` (unchanged). `ai-knowledge-memory` renamed "Enterprise Knowledge, Memory &
  Intelligence", tagline updated ("...& real-time intelligence"), gained
  `'Conversational Intelligence (CINTEL)'` in `techStack` and a clause in `description` ("...adds
  sentiment and quality signals on every exchange from day one") so the new "& Intelligence" in the
  name is actually backed by content, not just a label change. `description` also reworded from
  "The agent gets a brain" (which presupposed an agent already existed) to "The foundation the agent
  will run on", since this stage now comes BEFORE Agent Hookup.
- **IMPORTANT BUG caught during this session, not just cosmetic**: the AI↔Messaging/AI↔Voice gutter
  connectors (`messagingAiGutter`/`aiVoiceGutter` in `MaturitySection.tsx`) previously computed
  their column position from **the AI stage's own index** (`ai.stages.findIndex(s => s.id ===
  j.aiStageId)`), relying on the coincidence that `ai-messaging-hookup` was column 0 AND its
  junction targets (`msg-alerts`, `voice-outbound`) were also column 0. Moving
  `ai-messaging-hookup` to column 1 broke that coincidence — the connector would have rendered
  under the WRONG column (aligning with `msg-marketing`/`voice-cintel` instead of `msg-alerts`/
  `voice-outbound`). **Fixed at the root**: both gutters now compute `colIndex` from the
  **target's own column** (`messaging.stages.findIndex(s => s.id === j.toStageId)` /
  `voice.stages.findIndex(...)`) instead of the AI source's column — this is robust to the AI
  stream being reordered again in the future, since a connector's position now always tracks the
  Messaging/Voice tile it visually needs to align with, not wherever the AI tile happens to sit.
  Same pattern the cross-stream bridge gutters already used, just not previously applied to the
  AI-junction gutters.
- **React Compiler lint gotcha (new)**: after removing `ai.stages` from those two memos' deps, a
  THIRD unrelated memo (`crossRefs`) that still depended on `ai.stages` started failing with "React
  Compiler has skipped optimizing this component because the existing manual memoization could not
  be preserved" / `react-hooks/preserve-manual-memoization` — apparently only surfaces once the
  variable's usage pattern elsewhere in the component changes. Fixed by not closing over the outer
  `ai` variable at all inside `crossRefs`: replaced `ai.stages.find(...)` with
  `streamById.get('ai')?.stages.find(...)` and dropped `ai.stages` from the dependency array
  (already covered by `streamById`).
- Tag placement note: `tileTag()` keys `'Day 1 ready'` to the stage ID `ai-messaging-hookup`, not to
  array position — so after the swap it now correctly renders on the SECOND AI tile ("Agent
  Hookup"), not the first. No code change was needed there; it was already ID-based.
- `README.md` AI stream bullet reordered/renamed to match.

User caught that the Voice bridge in "Embedded Omnichannel Architecture" was landing on level 3
(Unified Inbound & Outbound Voice Platform) instead of the actual last stage, level 4 (Advanced
Analytics & Automations) — and asked for a third box so Flex explicitly unlocks the end-stage of
ALL THREE streams (Messaging, Voice, AND AI), not just two.

- **`maturity.ts`**: `flexShortcut.bridges` voice entry retargeted `voice-inbound-routing` →
  `voice-analytics` (now genuinely the last/most-advanced Voice stage) with an updated label. Added
  a THIRD bridge: `{ streamId: 'ai', toStageId: 'ai-unified', label: '...' }` — Flex now unlocks
  `ai-unified` (Unified Omnichannel Agent), the AI stream's own end-stage. `tagline` → "Flex SDK —
  one integration, three shortcuts"; `description` rewritten to say "ALL THREE streams" instead of
  "BOTH... streams". No other data changes — messaging bridge target (`msg-emerging-channels`) was
  already correct (already the last Messaging stage).
- **`MaturitySection.tsx`**: the Shortcut card's bridge grid `md:grid-cols-2` → `md:grid-cols-3` to
  fit the new AI bridge card (same `renderSide`-style card markup as before, just one more of them —
  the `flexShortcut.bridges.map(...)` loop already generalized over N bridges, so no new JSX branch
  was needed, just the wider grid). Strap line under the heading reworded: "One integration bypasses
  BOTH ladders below" → "One integration lands you on the advanced end-stage of all three streams
  above" (also fixed "below" → "above" since the card sits below the lanes, not above them).
- Because `flexBadge()` derives the ⚡ corner-glyph and detail-panel `crossRefs` chip purely by
  scanning `flexShortcut.bridges` at render time, retargeting the Voice bridge automatically moved
  the ⚡ glyph off `voice-inbound-routing` and onto `voice-analytics`, and a new ⚡ glyph appeared on
  `ai-unified` — no separate code change needed for either.
- `README.md` Adoption Arch bullet updated to describe 3 bridge cards (Messaging/Voice/AI) instead
  of 2, naming the correct end-stage per stream.

User feedback: (1) rename "Advanced CINTEL Analytics" (last Voice stage) → "Advanced Analytics &
Automations"; (2) there were now two visually similar "bridge" sections (the neutral white
Session-36 card AND the sunray Flex "Shortcut" card) — user prefers the Flex Shortcut visual and
wants the Messaging↔Voice relationship shown as an actual yellow LINE in the lanes themselves, not
a second card.

- **`maturity.ts`**: `voice-analytics.name` → "Advanced Analytics & Automations", tagline/description
  tweaked to mention automations (not just dashboards), techStack gained `'Automated Workflows'`.
  `crossStreamBridges` data kept as-is (still used for the gutter connector + crossRefs chips, just
  no longer rendered as its own card).
- **`MaturitySection.tsx`**:
  - **Removed** the standalone `crossStreamBridges.map(...)` "🌉 The Bridge" full-width card
    entirely (was duplicating the Flex Shortcut card's visual language and confusing the two).
  - `GutterConnector` reworked to support **multiple entries per column** (`entries.filter` instead
    of `.find`) and a `tone?: 'mint' | 'sunray'` field per entry (mint = existing AI-junction dotted
    style, sunray = new cross-stream-bridge dotted style, same dotted line weight, different color
    + glyph `🌉` vs `⋯`). Needed because the AI↔Voice gutter at column 2 now carries BOTH the
    existing `ai-voice-joins` AI-junction entry (mint) and the new cross-stream bridge entry
    (sunray) — they stack vertically in the same column slot instead of colliding.
  - New `messagingVoiceBridgeGutters` (`useMemo`) computes `{ top, bottom }` entries for
    `crossStreamBridges`: `top` goes in the Messaging↔AI gutter (label = the Voice target's name,
    click → opens the Voice stage), `bottom` goes in the AI↔Voice gutter (label = the Messaging
    target's name, click → opens the Messaging stage). Column index is the Messaging stage's own
    index, which happens to equal the Voice stage's own index (both are column 2 of 4) — confirmed
    this alignment still holds via the same "all 3 streams have identical stage count/tile width/
    gap" property relied on since Session 33, no JS measurement needed. The visual effect: a sunray
    dotted line drops from Messaging's Omnichannel Conversations tile, passes through the gutter
    gap ABOVE the AI lane, then picks back up in the gutter gap BELOW the AI lane and continues down
    into Voice's Unified Platform tile — i.e. it visually threads BEHIND the AI lane rather than
    literally overlapping any AI tile (deliberately did not attempt a single continuous line drawn
    across all 3 lanes — see Session 33's note on why that geometry was abandoned).
  - Tile corner glyph for 🌉 recolored `text-starwhite/80` → `text-sunray/90`; `crossRefs` chip
    style for labels starting with `🌉` recolored from neutral white to dotted sunray
    (`border-dotted border-sunray/40 text-sunray/80 bg-sunray/5`), so the whole cross-stream-bridge
    concept is now consistently yellow/sunray everywhere it appears (corner glyph, gutter connector,
    detail-panel chip) instead of the old neutral-white treatry.
  - Legend row's plain-text `🌉 cross-stream bridge` entry gained a matching dotted-sunray line
    swatch, consistent with the other legend entries.
- `README.md` Adoption Arch bullet rewritten: renamed stage, and replaced "dedicated Bridge card"
  description with "yellow dotted bridge running through the AI lane's gutters".

User insight: "Inbound, Voicemail & Queues" isn't really its own thing — inbound calling, voicemail,
queues and rules-based routing are sub-capabilities under the bigger-picture achievement of a
**Unified Inbound & Outbound Voice Platform** (outbound from stage 1 + inbound from this stage,
finally on one platform). This is the exact same shape as Messaging's "Omnichannel Conversations"
milestone (stage 3 unifying stage 1+2's separate sends into one thread) — and both milestones land
at the SAME column index (2) in their 4-stage streams, a nice (coincidental but reinforcing)
symmetry. User then asked for a visual bridge connecting these two milestones directly.

- **`maturity.ts`**: `voice-inbound-routing` renamed `name` → **"Unified Inbound & Outbound Voice
  Platform"**, `tagline` → "The big picture: outbound and inbound, one platform", description
  rewritten to lead with the unification framing and explicitly call inbound voice/voicemail/queues/
  routing "the sub-capabilities that make that unification real" (id/techStack/useCases unchanged,
  so `flexShortcut.bridges` and the `ai-voice-joins` junction targeting this id needed no id change
  — only `flexShortcut.bridges[1].label` text updated to reference the new name).
  - New **`CrossStreamBridge`** interface + `crossStreamBridges: CrossStreamBridge[]` export — a
    peer-to-peer link between two milestone stages in DIFFERENT streams (distinct from `AiJunction`,
    which is always AI-to-something, and `FlexBridge`, which is always Flex-to-something). One entry
    so far: `omnichannel-messaging-unified-voice`, `left: messaging/msg-omnichannel-conversations`,
    `right: voice/voice-inbound-routing`.
- **`MaturitySection.tsx`**:
  - Renamed the hover-highlight state from `flexHoverKey`/`setFlexHoverKey` → generic
    `bridgeHoverKey`/`setBridgeHoverKey` since it's now shared by BOTH the new cross-stream Bridge
    card and the existing Flex Shortcut card (only one thing is ever hovered at a time, so one piece
    of state is enough) — `renderTile`'s highlight check updated to `bridgeHoverKey === key`.
  - New **`streamBridgeBadge()`** helper + a third corner-glyph slot (🌉, `text-starwhite/80`) next
    to the existing ⋯ (AI pairing) and ⚡ (Flex target) glyphs — order in the tile header is now
    ⋯ / 🌉 / ⚡.
  - New rendering: `crossStreamBridges.map(...)` renders a **"🌉 The Bridge"** card, placed
    immediately after the 3 lanes and BEFORE the "⚡ The Shortcut" (Flex) card. Visually: white/
    neutral border (deliberately NOT sunray, so it doesn't get confused with the Flex card at a
    glance), a `grid md:grid-cols-[1fr_auto_1fr]` with a left stage card, a centered 🌉 glyph, and a
    right stage card — each side is a mini version of the Flex card's bridge-side (colored dot +
    stream name, mini progress-bar with only that ONE stage lit, stage icon+name+tagline),
    clickable to open that stage's detail panel and hover/focus-triggering the same
    `sunray-target-pulse` highlight on the real tile above via `bridgeHoverKey`. Did NOT attempt an
    actual SVG line crossing the AI lane between the two target tiles (they're 2 lane-gaps apart,
    Messaging↔AI↔Voice) — deliberately reused the proven card-based "bridge" visual language from
    the Flex shortcut (mini bars + hover-highlight) instead of resurrecting the fragile cross-lane
    connector-routing code removed in Session 33, per that session's explicit lesson.
  - `crossRefs`: added a `crossStreamBridges.forEach(...)` pass so a stage's detail panel shows a
    `🌉 <other stream> · <other stage>` chip when that stage participates in a bridge (looks up
    whichever side isn't the active stage). Chip styling gained a third branch (`🌉` → neutral
    white/border-white style) alongside the existing `⚡` (sunray) and default (dotted mint) cases.
  - Legend row gained a plain `🌉 cross-stream bridge` entry (no line swatch, since this connector is
    card-based rather than gutter-based like the AI junctions).
- `README.md` Adoption Arch bullet rewritten to mention the renamed Voice milestone and the new
  Bridge card.

Two asks: (1) the Session 34 merge went too far — "Omnichannel Conversations" (the persistent
Conversations API (Classic) thread) needed to come back as its OWN stage at Messaging level 3, with
Emerging Channels (RCS/WhatsApp/FBM) shifted to level 4, layered on top of it; (2) the Flex SDK
shortcut card wasn't obvious/clear enough as a bridge.

- **`maturity.ts`**: Messaging is back to **4 stages** (matches Voice/AI again): `msg-alerts` →
  `msg-marketing` → `msg-omnichannel-conversations` (NEW — "One thread, powered by Conversations API
  (Classic)", techStack `['Twilio Conversations API (Classic)', 'Cross-Session Continuity',
  'Conversation History']`) → `msg-emerging-channels` (rewritten to explicitly say RCS/WhatsApp/FBM
  "extend that same persistent thread... built in the previous stage", techStack trimmed to just the
  3 channel APIs since Conversations API itself moved to the new stage 3). `flexShortcut.bridges`
  messaging entry still targets `msg-emerging-channels` (unchanged id, still the last/most-advanced
  Messaging stage) — only the label text changed. `flexShortcut.description`/`tagline` rewritten to
  lead with "one integration, two shortcuts" framing.
- **`MaturitySection.tsx` — Flex shortcut card fully redesigned** to be unmissable:
  - Always-on subtle pulsing glow (`shortcut-glow`, new keyframe, sunray-toned, distinct from the
    `perimeter-glow` used for selection) so the card doesn't look inert even when not hovered.
  - New "⚡ THE SHORTCUT" eyebrow pill above the heading, bigger padding/border (`border-2`), bigger
    icon/heading, and a clearer one-line strap: "One integration bypasses BOTH ladders below — no
    walking every stop to get there."
  - Each of the 2 bridges is now its own big clickable card (was a small inline pill before) showing:
    a colored dot + stream name, a **mini progress bar** of that stream's stages (dim = skipped,
    bright sunray = the landed-on stage — makes "this skips N stops" visible at a glance instead of
    just stated in text), a bold "⚡ Lands directly on `<stage name>`" line, and a "Skips N earlier
    stage(s) in `<stream>`" caption computed from the target's index (no new data field needed).
  - **New `flexHoverKey` state** — hovering (or focusing, for keyboard users) a bridge card sets it;
    the matching tile in the lane above gets a new `sunray-target-pulse` ring/glow class (new
    keyframe, brighter/faster pulse than the shortcut card's own idle glow) so the exact tile the
    bridge lands on visibly lights up. This is the main fix for "the bridge needs to be more
    obvious" — before, the connection was only implied by matching text; now hovering the bridge
    card visually highlights the real target tile in place.
  - `renderTile` gained a `tileTag()` lookup — small absolute corner ribbon (`-top-2 -left-1`, white
    pill, doesn't affect tile height) reading **"Start here"** on `msg-alerts` and `voice-outbound`,
    and **"Day 1 ready"** on `ai-messaging-hookup` — reinforces the "no single required starting
    point, and AI can start immediately" story directly on the tiles themselves, not just in the
    intro paragraph.
- **`globals.css`**: added `sunray-target-pulse` (tile highlight on bridge hover, faster/brighter)
  and `shortcut-glow` (the Flex card's own always-on idle pulse) keyframes + classes.
- `README.md` Adoption Arch bullet rewritten to describe the restored 4-stage Messaging lane and the
  new shortcut-card behavior (mini progress bars + hover-highlight).

User feedback on Session 33's rebuild: (1) RCS should not be its own stage — group it with WhatsApp
and FB Messenger into one "Emerging Channels" stage; (2) the tiles were too tall for the swim-lane
layout to read concisely.

- **`maturity.ts`**: merged `msg-rcs-2way` + `msg-omnichannel` into a single new stage
  `msg-emerging-channels` ("Emerging Channels", tagline "RCS, WhatsApp & FB Messenger — one
  thread") — Messaging stream is now only **3 stages** (Voice and AI remain 4 each). Confirmed this
  doesn't break gutter alignment: `GutterConnector` column index is keyed off the AI stage's
  position, not the Messaging stage count, and the only `aiJunctions` entry touching Messaging
  targets `msg-alerts` (still column 0) — so nothing else needed to change. `flexShortcut.bridges`
  updated to target `msg-emerging-channels` instead of the old `msg-omnichannel` id.
- **`MaturitySection.tsx` tile redesign** — dropped from `w-48 p-4` with a wrapping techStack chip
  row + a separate wrapping badges row + a footer hint line, down to `w-40 p-3` showing only: index
  badge + icon + tiny `⋯`/`⚡` corner glyphs (replacing the old full-text pill badges), stage name
  (`line-clamp-2`), and tagline (`line-clamp-1`). techStack chips are now ONLY shown in the detail
  panel's "Twilio Building Blocks" section (already existed) — removing them from the tile face was
  the single biggest height reduction since chip-wrap count varied 1-4 lines per tile before.
  `GutterConnector` column width updated from `w-48` to `w-40` to match. Legend row updated to show
  the `⋯`/`⚡` glyphs inline next to their explanation text so the corner icons are self-explanatory.
- Detail panel, crossRefs chips, prev/next-within-stream, and the Flex shortcut card are all
  unchanged from Session 33 — only the tile face and the Messaging stage list changed.

User correction: the old "2-stage foundation → forward path (3-4-5) + parallel Stage N" shape did
not represent the real story — Messaging, Voice, and AI each mature independently with no strict
required order (e.g. a text AI agent can go live the same day as simple outbound calling), and Flex
SDK is a shortcut into advanced Messaging/Voice, not a 6th sequential stage.

**`src/lib/data/maturity.ts` — completely restructured** (old `MaturityLevel[]` single array is
gone). New exports:
- `streams: Stream[]` — exactly 3 entries (`messaging`, `voice`, `ai`), each with `color` and 4
  `StreamStage` entries (deliberately 4 stages per stream — see layout reason below):
  - Messaging (`#f44e27`): `msg-alerts` (Alerts & Notifications) → `msg-marketing` (Marketing SMS) →
    `msg-rcs-2way` (RCS & 2-Way Conversations) → `msg-omnichannel` (WhatsApp & FB Messenger).
  - Voice (`#6923f4`): `voice-outbound` (Outbound Calling, Client SDK + Branded Calling) →
    `voice-cintel` (+ CINTEL & Dispositions) → `voice-inbound-routing` (Inbound/Voicemail/Queues &
    Rules-Based Routing) → `voice-analytics` (Advanced CINTEL Analytics at scale).
  - AI (`#74fbd0`): `ai-messaging-hookup` (Messaging → Agent Hookup via TAC) →
    `ai-knowledge-memory` (Enterprise Knowledge & Memory) → `ai-voice-joins` (Voice AI Joins In) →
    `ai-unified` (Unified Omnichannel Agent).
- `flexShortcut: FlexShortcut` — single object (id `embedded-flex`, color sunray `#ecfd91`), with a
  `bridges: FlexBridge[]` array of exactly 2 entries: `{streamId:'messaging', toStageId:'msg-omnichannel'}`
  and `{streamId:'voice', toStageId:'voice-inbound-routing'}`.
- `aiJunctions: AiJunction[]` — exactly 3 entries, each `{aiStageId, streamId, toStageId, label}`:
  `ai-messaging-hookup ↔ messaging/msg-alerts`, `ai-messaging-hookup ↔ voice/voice-outbound`,
  `ai-voice-joins ↔ voice/voice-inbound-routing`. These are the "can run concurrently, no
  dependency" pairings (the messaging-hookup↔outbound-calling one is the exact example the user
  gave: a text agent can go live the same day as simple outbound calling).
- Dropped fields from the old model entirely: `level` (number), `prerequisite`/`prerequisiteNote`,
  `live` — none were referenced anywhere outside `MaturitySection.tsx` (confirmed via search before
  removing), so no other file needed updating.

**`src/components/showcase/MaturitySection.tsx` — full rewrite, DROPPED the SVG connector/ref-
measurement approach entirely** (the old `buildElbowPath`/`roundedPolyline`/`updateConnector`
machinery from Sessions 28–32 was single-connector-to-one-details-panel; with 3 stacked lanes plus
cross-lane pairings there would be multiple simultaneous connectors, and that geometry system was
already documented as fragile/high-effort across many prior sessions). New approach instead:
- **Lane order is Messaging → AI → Voice (AI placed in the middle deliberately)**, so both
  `aiJunctions` gutters are exactly one lane-gap each (Messaging↔AI gutter and AI↔Voice gutter) —
  no junction needs to cross over a third lane. Confirmed alignment works because **all 3 streams
  have exactly 4 stages** using identical tile width (`w-48`) and identical `gap-3 md:gap-4` in a
  `justify-center` row — column *i* lines up across every lane without any JS measurement.
- `GutterConnector` (new, pure CSS/flex, no refs/no resize listener) renders an invisible row with
  the same column structure as the tile rows, and drops a small dotted vertical connector + clickable
  label chip only in the column(s) that have a junction (col 0 in both gutters for
  `ai-messaging-hookup`, col 2 in the AI↔Voice gutter for `ai-voice-joins`). Hidden on mobile
  (`hidden md:flex`) since tiles wrap there and column alignment breaks — badges on the tiles
  themselves are the mobile-friendly equivalent.
- Every tile also gets small pill **badges** under its tech-stack chips: AI tiles show outgoing
  `⋯ pairs with <stream> · <stage>` badges; junction-target tiles show `⋯ pairs with AI · <stage>`;
  Flex-bridge-target tiles (`msg-omnichannel`, `voice-inbound-routing`) show a dashed
  `⚡ Flex SDK shortcut lands here` badge. Purely decorative `<span>`s (not nested buttons) to avoid
  interactive-in-interactive issues since the whole tile `div` is itself `role="button"`.
- **Flex shortcut is its own full-width dashed card** below all 3 lanes (not a 4th lane, not
  positioned between lanes) — avoids ever needing a connector line that crosses the AI lane
  visually. It shows its 2 bridges as clickable pill buttons ("⚡ Shortcut to Messaging ·
  WhatsApp & FB Messenger" / "⚡ Shortcut to Voice · Inbound, Voicemail & Queues") that open that
  target stage's detail panel directly (`e.stopPropagation()` so it doesn't also toggle the Flex
  card itself).
- **Selection model**: `selectedKey` is `${streamId}--${stageId}` for a stage, or the literal
  string `'flex'` for the shortcut (changed separator from `-` used in the old single-array
  `#maturity-<id>` hash scheme to `--` specifically so splitting the key is unambiguous). A unified
  `DetailData` shape (`kind: 'stage' | 'flex'`) lets ONE details-panel render path serve both a
  stream stage and the Flex shortcut — same use-case cards / value columns / building-block chips
  as before, reused verbatim.
- **`crossRefs`** — computed per active detail, renders as clickable pill chips right under the
  description in the details panel: for a stage, shows any outgoing AI junctions, any incoming AI
  junction (if it's a junction target), and a `⚡ Flex SDK shortcut` chip if it's a bridge target;
  for the Flex shortcut, shows its 2 bridge targets. Clicking any of these jumps straight to that
  detail (same mechanism as clicking the tile).
- **Prev/Next + progress dots are now scoped to the CURRENT stream** (`goPrevNext` only moves
  within `stream.stages`), not global across all 12 stages+shortcut — hidden entirely when the
  Flex shortcut is the active detail (`activeDetail.kind === 'stage'` guard).
- New legend row under the intro paragraph: 3 colored dots (Messaging/Voice/AI) + a solid-line
  swatch ("typically follows, within a stream") + dotted mint swatch ("optional AI pairing") +
  dashed sunray swatch ("Flex SDK shortcut") — sets expectations before the diagram.
- Intro copy rewritten to state the "no single required order" premise explicitly, with the
  Day-1-text-agent-alongside-outbound-calling example named directly.
- No new CSS added — reused existing `perimeter-glow`/`idle-glow`/`animate-fade-up` from
  `globals.css` (the old `connector-line-svg`/`connector-glow-pulse` classes are now unused dead
  CSS, left in place since they may still be handy and there's no tool to prune globals.css safely
  without risking an unrelated regression).
- Lint gotcha (same family as before): an `// eslint-disable-next-line react-hooks/exhaustive-deps`
  on the mount-only hash-read effect was flagged as an **unused directive** this time (no
  exhaustive-deps violation was actually present with an empty `[]` array once the effect no longer
  referenced `byId`/other data-derived state) — removed it; only the
  `react-hooks/set-state-in-effect` disable on the inner `setSelectedKey` call was actually needed.

`README.md` + `package.json` description reworded for the 3-stream + Flex-shortcut framing.

- `src/components/showcase/MaturitySection.tsx`: replaced `buildElbowPath` with generic `roundedPolyline(points)` helper (rounded corners on arbitrary waypoint list).
- Added `tracksRef` on the two-track grid; connector state now stores a finished path string (`connectorPath`).
- When the selected stage is in the FOUNDATION row (above the track panels), the connector now drops a short stub, runs LEFT to a gutter just outside the track panels, down past both tracks, then across to the detail panel — so it no longer crosses stages 3/4/5.
- Stages inside a track keep the simpler drop → travel-below-map → drop routing.

## Session 31 — Connector reroute (z-index alone wasn't enough)
- Raising tiles to `z-20` did not satisfy the user — the line still visually crossed Stage 5. Real
  fix is geometric: `buildElbowPath` now takes an explicit `travelY` instead of computing
  `y1 + min(height*0.45, 40)`. `updateConnector` measures the new `mapRef` (the whole stage-map
  wrapper) and passes `mapBottom + 16`, so the horizontal run happens in the gap BELOW both track
  cards. `travelY` is clamped to `[y1+16, y2-16]`. `connector` state now carries `travelY`.
- Tiles keep `relative z-20` and the svg keeps `z-0` as belt-and-braces.

## Session 30 — Connector line drawn over a neighbouring stage
- Stage 3's elbow connector crossed the face of Stage 5. Fix: stage tiles are now `relative z-20`
  and the connector `<svg>` dropped from `z-10` to `z-0`, so the line passes UNDER the tiles.
  (The path-track cards were deliberately left un-layered so the line still reads across their
  translucent background.)
- Gotcha that cost a build: a JSX comment cannot be placed as a second child inside
  `{cond && ( … )}` — webpack fails with a bare `Error:` and no message. The comment has to live
  outside the conditional expression.

## Session 29 — Capability cards start still, click to animate
- `Capability` gained `posterUrl?: string`. Set on `conversation-relay`
  (`.../YqSMDKJd/barrys-ai-voice-concierge-poster-alt.png`) and `rcs`
  (`.../k4d7TVm1/barrys-rcs-showcase-poster.png`). The row had four things animating at once.
- New `PlayableCapability` in `CapabilitiesCarousel.tsx` — a `<button>` styled with the shared
  `FRAME`, local `playing` state, `img src = playing ? imageUrl : posterUrl` (toggles both ways).
  While still: `mint-glow-ring` on the button, a `bg-black/25` scrim, a mint circular play badge and
  a "Tap to play" caption. It is checked FIRST in `PhoneCapability`, before videoUrl/imageUrl.
- `globals.css`: new `mint-glow-ring` keyframes/class (mint box-shadow pulse, 1px→3px ring), matching
  the green accent used by the nav rail.

## Session 28 — AI Voice Concierge card now a GIF
- `capabilities.ts` `conversation-relay` gained `imageUrl: https://i.postimg.cc/Gm41c3pJ/barrys-ai-voice-concierge.gif`
  (388×800 — identical to the RCS showcase GIF, so it drops straight into the shared 240×490 `FRAME`
  via the existing imageUrl branch with `object-contain`; no sizing change needed).
- Its scripted `messages` array is left in the data but is now dead: `PhoneCapability` checks
  `videoUrl → imageUrl → videoEmbedUrl → PhoneFrame`, so imageUrl wins.

## Session 27 — Larger desktop One View GIF
- Measured both GIFs by reading the logical-screen bytes (offset 6–9, little-endian) over a ranged
  fetch — old `XN2GHGc4/...desktop.gif` = **776×800**, new `DfRkyk9v/...desktop-lg.gif` = **970×800**.
  (`gif-dims.cjs` at the repo root was the throwaway script; it's blanked now. Ranged fetch + GIF
  header bytes is the fastest way to get remote image dimensions in this environment.)
- `capabilities.ts` `conversations-classic.imageUrl` → https://i.postimg.cc/DfRkyk9v/xplor-unified-inbox-desktop-lg.gif
- `WIDE_FRAME` in `CapabilitiesCarousel.tsx`: `h-[490px]` → `h-[380px] sm:h-[480px] md:h-[588px]`.
  Maths: old render was 490 tall × 475 wide (776/800 aspect). 588 = +20% height; the new 970/800
  aspect at 588 tall gives ~713 wide = +50% width. Width is still natural (`h-full w-auto`), so the
  two asks are satisfied purely by the height bump plus the wider source.

## Session 26 — Adoption Arch naming
- `ShowcaseClient.tsx` nav label for `#maturity`: "Maturity Framework" → **"Adoption Arch"**.
- `MaturitySection.tsx` h2 now three hard lines: "Xplor Technologies" / "AI-Native Communications" /
  "Adoption Arch". Section id/hashes (`#maturity`, `#maturity-<id>`) deliberately left unchanged.
- README bullet + package.json description reworded to the Adoption Arch (foundation → forward path +
  parallel Stage N) instead of the old drag-and-drop 6-level maturity framework.

## Session 25 — Framework rebuilt as an adoption arch with parallel paths
- Title → "Xplor's AI-Native Communications" / `<br />` / "Adoption Arch". Intro paragraph rewritten
  (no drag copy). Removed the section-level ⚠ prerequisite banner AND `prerequisite`/
  `prerequisiteNote` from the `dual-channel-voice` entry in `maturity.ts` (interface fields kept optional).
- `MaturitySection.tsx` rewritten: ALL drag-and-drop / reorder / `order` state / `LOCKED_ID` /
  `moveTile` / reset-order / per-tile ←→ buttons removed. No longer uses `HorizontalScrollRow`
  (that component is now only referenced by nothing — left in place, unused).
- New layout, centred via `mx-auto w-full max-w-6xl px-6 md:px-16`:
  Foundation row (stages 1 → 2, `flex-wrap justify-center`) → `Branch()` (absolutely-positioned
  stem + legs at `left:33%`/`right:17%`, `hidden md:block`) → `grid md:grid-cols-[2fr_1fr]`:
  left card = "Forward path · continues in order" (stages 3 → 4 → 5), right dashed card =
  "Parallel path · any time after Stage 2" holding the Flex SDK stage.
- `PARALLEL_ID = 'embedded-flex'`; its badge label is literally **"N"** (not 6) — labels come from a
  `Map` built from `mainPath` index + 1, so numbering is fixed and no longer derived from tile order.
  Details header now reads "Stage {label} · {tagline}" and shows a "Parallel path" chip for Stage N.
- Tiles narrowed `w-56` → `w-48` so 3 tiles fit inside the 2fr column at `max-w-6xl` minus `px-16`.
  Tiles are now `role="button"` + Enter/Space handlers (no drag affordance). Everything else in the
  details panel (use cases, value columns, building blocks, dots, prev/next, elbow connector,
  hash deep-links) is unchanged.

## Session 24 — Capabilities view switcher moved above the panels
- Problem: the absolutely-positioned left/right arrows (`top-[245px]`, `left-1`/`right-1`) sat at the
  stage edges, so on narrow viewports they were hard to reach and the right one rendered UNDER the
  fixed `NavRail` (`fixed right-6`, z-50).
- `CapabilitiesCarousel.tsx`: arrows are no longer absolute. New `ViewSwitcher` renders a centred
  horizontal control `arrow — 2 beads — arrow` (the horizontal twin of NavRail's dot rail) in an
  `mb-8` block ABOVE the panels. Beads are clickable (bead style copied from NavRail: active
  `w-3 h-3 bg-mint`, idle `w-2 h-2 bg-white/30`). The arrow with nowhere to go is `disabled` + dimmed
  rather than swapped out, so the control never shifts.
- Stage padding relaxed from `px-16` to `px-6 md:px-8` (no arrow gutters needed now) and the phone row
  gained `flex-wrap lg:flex-nowrap` so it wraps instead of overflowing on small screens.
- Nudge: `IntersectionObserver` (thresholds `[0, 0.35, 0.75]`, fires while ratio > 0.35) on the stage
  wrapper sets `nudge`; killed permanently once `interacted` is true (the effect early-returns and the
  observer is never re-attached). Right arrow gets `nudge-right` on the svg + `nudge-halo` on the
  button. Both keyframes added to `globals.css`.


## Session 20 — Embedded Capabilities cleanup
- `capabilities.ts`: removed `group-messaging` (Class & Community Threads) card entirely; removed both `note` warnings (Branded Calling registration, RCS sender approval).
- Renames: `rcs` → "Rich, Two-Way Member Messaging" (new desc: imagery/carousels/quick replies, confirm/reschedule/pre-order/rate). `conversations-classic` → product "Conversations", title "Messaging and Voice, One View" (new desc: SMS/RCS/WhatsApp/Messenger + call summaries + click-to-call).
- New optional `imageUrl` field on Capability; conversations card now renders GIF https://i.postimg.cc/1566YRWR/xplor-unified-inbox.gif in the shared device frame (object-contain so nothing crops, same 240×490 frame as video cards). Plain `<img>` used, so no next.config domain needed.
- `CapabilitiesSection.tsx`: extracted shared `FRAME` class const; removed the "RCS and Branded Calling mockups…" disclaimer paragraph, the ⚠ note block, and the "See it live in the guided journey →" link (`live` flag still in data but unused in UI).
- `HorizontalScrollRow.tsx`: added optional props `center` (applies `[justify-content:safe_center]`), `padClass`, `fadeClass` — defaults preserve MaturitySection behaviour. Capabilities row now wrapped in `max-w-6xl mx-auto` with `px-12 md:px-16` so cards align with the section heading.

## Session 21 — Capabilities two-row layout
- `capabilities.ts`: added optional `wide?: boolean`. Order is now conversation-relay, branded-calling, rcs, whatsapp, then conversations-classic (wide, last). Renames: product `Enhanced Branded Calling + Voice Insights` → `Branded Calling + Voice Insights`; title `Rich, Two-Way Member Messaging` → `Rich, Two-Way Messaging`. conversations-classic imageUrl → https://i.postimg.cc/XN2GHGc4/xplor-unified-inbox-desktop.gif
- `CapabilitiesSection.tsx` rewritten: no longer uses `HorizontalScrollRow` (arrows gone). Split into `CapabilityCaption`, `PhoneCapability`, `WideCapability`. Top row = `flex flex-wrap justify-center gap-x-6 gap-y-14` full-width `px-6` (centers in viewport, not in the max-w-6xl heading container). Wide row below uses `WIDE_FRAME` (h-[420px] md:h-[490px], rounded-2xl) with `<img className="h-full w-auto max-w-none">` so width follows aspect ratio. `min-h-screen` dropped from section since it now needs two rows of height.
- `HorizontalScrollRow` still used by MaturitySection — left untouched.

## Session 22 — Capabilities paged carousel
- `MemberJourneySection.tsx`: headline hard-broken — "One member. Four acts." / `<br />` / "Every message and call is real."
- New `src/components/showcase/CapabilitiesCarousel.tsx` ('use client'): two pages, no scrolling and no fade masks. Page 0 = the 4 phone cards (`justify-center`, w-[260px] each, gap-4/6). Page 1 = the wide desktop GIF card. Single arrow button: right arrow on page 0 ("See the staff desktop view"), left arrow on page 1 ("Back to member channels"); absolutely positioned at `top-[245px] -translate-y-1/2` (frame vertical center) with container padding `px-16 md:px-20` so arrows never overlap cards.
- Both `FRAME` (240×490 phone) and `WIDE_FRAME` (h-[490px], rounded-2xl, `img h-full w-auto max-w-none`) live in the carousel file. Captions share `max-w-[260px]` on both pages.
- `CapabilitiesSection.tsx` is back to a slim server component: splits `capabilities` into `phones` (!wide) + `desktop` (wide) and renders the carousel. `min-h-screen snap-start` restored since it is one row again.
- Arrow placement tightened: carousel stage is now a fixed `w-[1240px] max-w-full mx-auto px-16` box (= 4×260 + 3×24 content + 64px gutters), arrows at `left-1`/`right-1` inside those gutters so they hug the phones and stay at the identical x-position on the desktop page. `WIDE_FRAME` gained `max-w-full` and its img `max-w-full object-contain` so a very wide GIF can never slide under the arrows.
- RCS card: dropped the YouTube `videoEmbedUrl` in favour of `imageUrl: https://i.postimg.cc/Jh4vGDsd/barrys-rcs-showcase.gif` — renders in the standard 240×490 FRAME via the existing imageUrl branch (object-contain). `videoEmbedUrl` branch is now unused by data but kept in the component.

## Session 23 — Flex intel sync fix + NBA gating
**Root cause of "retention score not updating in Flex":** `buildTaskAttributes` writes `journey_call_sid`, but `fetchFlexTask` filtered on `call_sid == "…"` — so `state.flex.taskSid` was never resolved, and `syncIntelToFlexTask` early-returned every time. The Flex panel only ever showed the snapshot baked into the Enqueue attributes.
- `flex.ts`: attributes now include BOTH `call_sid` and `journey_call_sid`. `fetchFlexTask` tries `call_sid`, then `journey_call_sid`, then falls back to newest task with `escalated_by == "Emerald Fitness voice AI"`. `pollForTask` calls `pushIntelToFlexTask(state)` once the SID resolves so pre-handoff operator results land.
- `intel.ts`: split the sync — `syncIntelToFlexTask(state)` is now a **sync** debouncer (1200ms, always fires a trailing pass; the old `syncQueued` boolean silently dropped the newest result), `pushIntelToFlexTask(state)` does the actual merge-patch and will lazily `fetchFlexTask` (dynamic import to avoid a cycle) if taskSid is missing but `transferred` is true.
- NBA gating: new `intel.pendingNextBestAction` (server-only) + `CANCEL_INTENT` regex + `memberRaisedCancellation(state)` + `releasePendingNextBestAction(state)`. An NBA result is parked in `pendingNextBestAction` unless a member transcript line on THIS call matches cancel intent (cancel/quit/end my membership/not worth it/not renewing/leave the gym/walk away/done with…). `voice.ts` calls `releasePendingNextBestAction` right after each member `addTranscript`, so it promotes in the same beat she says it. Note: grumbling about results ("not using it", "not seeing results") deliberately does NOT open the gate.
- `bus.ts` `screenSafeState` now strips `pendingNextBestAction` as well as `nextBestAction`.
- Requires Push & Redeploy (Railway) to take effect.



## Session 19 — hold-call opening fix
- `server/src/journey/voice.ts` → `holdPrompt` step 1 rewritten: after-hours "floor is closed" line must now be delivered in the SAME turn as the answer when the member's opening utterance already contains a hold request (offer 30/60/90 immediately). Neutral listen-first behaviour retained only when her opening is vague/unclear.
- Added hard rules: never split acknowledgement and length offer across turns; never ask her to repeat a clear request; the courtesy line never replaces answering.
- No new packages/env vars. Requires Railway "Push & Redeploy".

## Session 18 — REAL real-time Conversation Intelligence in the guided journey (4 signals)

**Key architectural discovery:** the journey's voice calls ALREADY flow through Conversation
Orchestrator. `TWILIO_CONVERSATION_CONFIGURATION_ID=conv_configuration_01kfy8k1k1fx0rfcsa6qcsns1c`
("wilke-maestro1") has VOICE **and** SMS/RCS capture rules for `+18668144982` both directions,
`memoryExtractionEnabled: true`, memory store `mem_store_01kfy8jrdpf7h9x8wsmq7r1mh2`. TAC's
`voiceChannel.handleIncomingCall()` injects `conversationConfiguration` when the orchestrator is
enabled, so ConversationRelay transcripts are captured live — meaning intelligence configurations
attached to that conversation configuration run **during** the call. No relay/TwiML change needed.

**API hosts / paths that work (verified live):**
- `https://intelligence.twilio.com/v3/ControlPlane/{Operators,Configurations}`
- `https://knowledge.twilio.com/v2/ControlPlane/KnowledgeBases` and
  `https://knowledge.twilio.com/v2/KnowledgeBases/{kbId}/Knowledge`
- `https://conversations.twilio.com/v2/ControlPlane/Configurations` (NOT `/v2/Configurations` — 404)
- Twilio prebuilt Sentiment operator: `intelligence_operator_01kcrvw16kfa88qvgrfmr7y151` (v3,
  outputFormat CLASSIFICATION, result `{label}`). Others: Summary `…01kcv35pnkeysaf6z6cqtbpegn`,
  NBR `…01kea27sy7ffsafmtsfp17nzx4`, Script-Adherence `…01kf34tcyefpyb1t4m0nbd8rxg`.

**GOTCHAS (cost real time):**
- Knowledge base `displayName` must match `^[a-zA-Z0-9-]+ (error 20001) → used `emerald-fitness`.
  Knowledge source `name` max 30 chars → `retention-save-playbook`.
- Knowledge POST responses do NOT echo the created object in a predictable shape (`id` came back
  undefined) → always re-LIST after create and find by name. Raw text worked with
  `source: { type: 'Text', content }`.
- The conversation-configuration PUT **response** returns `intelligenceConfigurationIds: []` even
  though the write succeeded. Verify with a follow-up GET, do not panic and re-run.
- `createOrModifyTwilioResource` still can't do nested JSON → all of this is in
  `server/provision-cintel.cjs` (idempotent, safe to re-run, reads /home/project/.env).

**Provisioned on the account (append-only; healthcare + gtma configs left untouched):**
- KB `know_knowledgebase_01kz6wzfpaes6tc5bpps1d6400` + source `know_knowledge_01kz6x05p6fjdshyrzqk7dwrky`
  (the Emerald retention/save playbook — hold lengths, reinstatement, approved save offers =
  win-back class + 15-min coaching reset, never-offer list, risk signals, tone).
- Operators (all `author: SELF`, `outputFormat: JSON`, memory context on; risk + NBA also knowledge):
  `EMERALD_OP_CALL_REASON=intelligence_operator_01kz6x06ktfhjbrbrt9qa5amq2`,
  `EMERALD_OP_RETENTION_RISK=…01kz6x06s2ee6rq9vdrrpb89x5`,
  `EMERALD_OP_NEXT_BEST_ACTION=…01kz6x06xmecdra4mhhq77kvrq`.
- `EMERALD_INTEL_CONFIG_ID=intelligence_configuration_01kz6x07amffhs89jt6v0m0vh3`
  ("emerald-fitness-realtime"), 2 rules → webhook `POST <railway>/journey/cintel`:
  rule 1 = [call reason, sentiment] `COMMUNICATION count 1`; rule 2 = [risk, NBA]
  `COMMUNICATION count 2` with `context.knowledge.bases`.
- Appended to wilke-maestro1's `intelligenceConfigurationIds` (now 5 entries).

**New `server/src/journey/intel.ts`** — `JourneyIntel` state (reason/sentiment+trail/risk+trail/
nextBestAction/runs/totalRuns), `applyRuleExecution()` (drops non-VOICE results so Acts 1–2
RCS/SMS turns don't pollute the panel; never lets a fresh "not clear yet" overwrite a resolved
reason; writes a system transcript line the first time an NBA is recommended),
`intelForTask()` (flat snake_case block for Flex task attributes), `syncIntelToFlexTask()`
(1.2s-throttled merge-patch of `tasks(sid).update({attributes})`, silent on failure),
`checkIntelHealth()` (30s cache; reads the config + confirms it's still attached to the
conversation configuration; `receiving` flips once any result has arrived).

**Wiring:** `state.ts` gained `intel?: JourneyIntel`; `voice.ts` calls `resetIntel(state)` at call
start; `flex.ts` `buildTaskAttributes()` includes `intelligence: intelForTask(state)`;
`routes.ts` added `POST /journey/cintel` (always 204, never blocks the call), `POST /journey/intel-check`,
and `intel` on `/journey/config`.

**UI:** new `src/components/journey/IntelligencePanel.tsx` rendered UNDER the live call stage on
`call-prompt`/`call-live`/`desk` beats (reason chip + evidence quote, sentiment + trail arrows,
0–100 risk meter with driver chips and quote, live strip with operator/latency). NBA is
deliberately NOT rendered there — the footer says so explicitly. `IntelChip` added to the workspace
header next to RcsChip/FlexChip. Types mirrored in `src/lib/journey/types.ts`.

**Flex plugin → 1.1.0** (`FLEX_PLUGIN_VERSION` bumped, so the URL and Flex's cache key change):
`bundle.ts` gained `intelOf/hasIntel/BANDS/SENTIMENTS/bandFor/Meter/NextBestAction/IntelBlock`;
NBA card renders FIRST in the CRM panel, then the intelligence block; Info tab summary gained a risk
pill, "Calling about", and the recommended offer. Mirrored properly in
`/flex-plugin/src/components/Intelligence.tsx` + context types + MemberSummary + package.json 1.1.0.
Re-registered: Version `FV1c2824906874a3e1bbcc193f72230010`, Configuration
`FJ63e82e70ef9a74d5cd444eed31efe6c4`, Release `FK25f728f1d63747ec3d33f72ca2b3ee61`.
`verify-plugin-render.cjs` now feeds a full `intelligence` payload and asserts the NBA/risk strings.

**Prompt/narrative changes:** `callbackPrompt` hard rules gained one clause — acknowledge "I'm not
using it / not seeing results" warmly in her words, but the agent is explicitly FORBIDDEN from
offering a free class, coaching, discount or refund (that's the human's move, which is the whole
point of the NBA landing in Flex). `CallStage.tsx` callback variant gained a second suggested line
so the presenter knows what to say to make the risk score climb.

## Session 18c — Removed Self-Assessment, hid Try It Yourself

- `AssessmentSection.tsx` blanked to an inert `export {}` stub (can't delete files) and dropped from
  `ShowcaseClient.tsx` + the nav array. `lib/data/quiz.ts` left in place, now unused.
- Live Demos hidden behind `const SHOW_LIVE_DEMOS = false` in `ShowcaseClient.tsx` — gates BOTH the
  nav entry (spread into the `sections` array) and `{SHOW_LIVE_DEMOS && <LiveDemosSection …/>}`.
  Kept the import + the conditional render specifically so `phoneNumber` stays used and no lint
  error appears; flipping the const back to `true` fully restores it.
- Three now-dead `#live-demos` links repointed to `#member-journey`: `ClosingSection` ("Revisit the
  guided journey"), `CapabilitiesSection` (`cap.live` → "See it live in the guided journey →"),
  `MaturitySection` detail panel ("See it in the guided journey ↓").
- Section order is now: Hero → Story → Capabilities → Maturity → Member Journey → How It Works (WIP)
  → Closing.

## Session 18b — NBA leaked onto the demo screen; hold-call wording

User saw a "System — Next best action recommended to the front desk — Offer hold first: …" line in
the Act 3 transcript. Two separate faults:
1. `applyRuleExecution` was writing an `addTranscript(state, "system", …)` line whenever a new NBA
   arrived. **Removed** (and the now-unused `addTranscript` import dropped from intel.ts).
2. Belt and braces, the NBA is now **stripped server-side** before state leaves the server on the
   demo path: new `screenSafeState(state)` in `bus.ts` deletes `intel.nextBestAction`, used by
   `pushState()` (WebSocket) AND by `publicState()` in `routes.ts` (HTTP). Flex still gets it via
   `intelForTask()` → task attributes, which does not go through either path. `DeskStage` renders
   explicit fields rather than the raw attribute payload, so it does not leak there either.
3. The NBA operator was also recommending "offer hold first" on the routine Act 3 call. Prompt
   updated (operator now at **version 2**) with: routine hold for travel/work is ROUTINE, recommend
   nothing; never recommend an action the agent is already carrying out. Re-ran
   `provision-cintel.cjs` — the PUT-by-displayName update path works and bumps `version`.

`holdPrompt` restructured to 7 steps: acknowledge the request in one line THEN offer 30/60/90 →
confirm the end date → place → confirm dates + length + no billing + rate locked + confirmation on
her phone → **ask if there's anything else** → close. The `place_membership_hold` tool return string
now instructs that same closing sequence. Added a hard rule that it may not offer free classes,
coaching, credits, discounts or refunds.

## Session: Voice stream use case copy refresh
- `src/lib/data/maturity.ts` — `voice-inbound-routing` stage: both use cases replaced. "Skill-Based
  VIP Routing" + "After-Hours Voicemail-to-Text" → **"One Screen, Every Call"** (Studio operators
  never leave the Mariana Tek platform — calls, voicemail, and routing all live in the same screen
  they already use for check-ins and bookings.) + **"Unified Call Handling Toolkit"** (Voicemail,
  warm call transfer, a shared studio inbox, and Conversational Intelligence scoring apply
  automatically to every call, inbound or outbound.).
- `voice-analytics` stage: "Compliance & QA Language Operators" replaced with **"Generative
  Operators & Cross-Channel Observability"** (Configure generative custom operators to auto-detect
  disclosures, script adherence, call scoring, sales analysis, and even AI agent observability
  across every interaction.) — kept "Platform-Wide Sentiment Benchmarking" unchanged.
- Data-only change (titles/descriptions inside `useCases` arrays) — no type/component changes.

## Session: Trim two BMS value bullets on Advanced Analytics & Automations
- `voice-analytics.bmsValue` first bullet: removed the trailing sentence "Monetizing the add-on
  module at $99/month per location across 1,000 studio accounts with a 15% adoption rate would
  yield an additional $178k ARR per year." — kept the "Mariana Tek Sentiment & Retention
  Intelligence" packaging sentence.
- Third bullet (ChartMogul-cited): removed "achieve Gross Revenue Retention (GRR) of 90%+ and" so
  it now reads "Software platforms offering proprietary peer benchmark insights increase feature
  adoption rates by 25%." — citation/href unchanged.

## Session: AI stream value statements fully replaced (all 4 stages) + multi-citation support
User supplied verbatim replacement copy for `studioValue` + `bmsValue` on every AI stage, with real
citation URLs for some bullets. First approval attempt was rejected — my draft described citations
as if they'd render as separate bullets and used raw \u2014-style escape sequences in the plan text,
which read as garbled; resubmitted in plain language making clear citations render as the existing
small dotted-underline link style, not new list items.
- **`ValueBullet` type extended** (`maturity.ts`): added optional `citations?: { citation: string;
  href: string }[]` alongside the existing single `citation`/`href` fields — needed because the
  `ai-unified` valuation-premium bullet has TWO real sources (Meritech + 733Park) and the type
  previously only supported one. Plain strings and single-citation bullets are unaffected.
- **`ValueList` in `MaturitySection.tsx`**: when `citations` is present it renders each as its own
  small dotted-underline link in a `flex flex-wrap gap-x-3` row (same `text-[11px] text-white/35
  hover:text-mint` styling as the existing single-citation link) instead of one link — the
  single-citation and no-href branches are now gated on `!citations` so they don't double-render.
- **`ai-knowledge-memory`**: studioValue → "Out-of-the-Box Intelligence" (unstructured docs, no
  training) + "ROI-Rich Personalization" (London/Joey/Tread example). bmsValue → "VIP Concierge &
  Profile Memory Engine" + enterprise SOP competitive-moat bullet. No citations given for this
  stage — both sides are plain strings (no $/%/Nx figures to auto-flag anyway).
- **`ai-messaging-hookup`**: studioValue → 80%-deflection/30%-cost-reduction bullet cited to Gartner
  (Mar 2025 press release on agentic AI resolving 80% of service issues by 2029 — URL kept exactly
  as given, including what looks like a trailing-digit typo in the slug) + 21x lead-qualification
  bullet cited to Harvard Business Review ("The Short Life of Online Sales Leads"). bmsValue →
  ARPU $30–$80/$250+ add-on pricing bullet (`sourced: true`, no citation given) + platform-
  stickiness bullet (plain string, no metric).
- **`ai-voice-joins`**: studioValue → 10x lead-capture-lift bullet cited to ABC Fitness (Replify
  acquisition press release, full `#:~:text=` fragment preserved) + 2,000%-conversion bullet cited
  to the same HBR article as above. bmsValue → Premium Voice Add-Ons ARPU $100–$300+/month bullet
  (`sourced: true`, no citation) + telephony-stickiness bullet (plain string).
- **`ai-unified`**: studioValue reduced to a single bullet, "Native BMS UI Embed" (plain string).
  bmsValue reduced to a single bullet — the 45–95% valuation-multiple-premium claim — now using the
  new `citations` array with BOTH Meritech ("Meritech Software Pulse — July 2, 2026") and 733Park
  ("Embedded Payments & M&A") rendered side by side. Note: this is the same underlying claim already
  present in `flexShortcut.bmsValue` (Flex accelerator card, 733Park-only) — left that one
  untouched since the user only asked about the `ai-unified` stage this session.

## App
"Xplor + Twilio | Platform Showcase" — single-page, scroll-snapped interactive presentation.
Framing: shows how Twilio's platform embeds inside Xplor Technologies' ISV brand **Mariana Tek**
(boutique fitness business management software) to power AI-native member experiences. Backend
type: custom (has /server with a pre-existing full TAC voice/chat/SMS AI agent — twilio-agent-connect,
memory, segment tracking, sendgrid email tool — built before this session).

## Brand theme (real Xplor/Mariana Tek tokens, scraped from marianatek.com WP theme CSS vars)
- Deep Space (bg): #220021, light variant #4e324d
- Neptune Blue (primary): #6923f4, hover #9d70f7
- Xplorange (accent): #f44e27
- Supernova Green / "mint" (accent): #74fbd0
- Sunray Yellow: #ecfd91
- Blush Pink: #ff8df4
- Star White (light text/bg): #fff7f3
- Fonts: Poppins (headings), Roboto (body) — loaded via next/font/google in layout.tsx
- Tailwind v4 `@theme inline` tokens added in globals.css: --color-deepspace, --color-neptune,
  --color-neptune-hover, --color-xplorange, --color-mint, --color-sunray, --color-blush,
  --color-starwhite, --color-ink (so `bg-neptune`, `text-mint`, etc. work as Tailwind utilities).

## Structure
- `src/app/page.tsx` — server component, reads `TWILIO_PHONE_NUMBER`, renders `ShowcaseClient`.
- `src/components/showcase/ShowcaseClient.tsx` — 'use client' orchestrator: snap-scroll container,
  IntersectionObserver-driven NavRail, renders all 7 sections in order:
  Hero(#perspective) → Story(#story) → Capabilities(#capabilities) → LiveDemos(#live-demos) →
  Maturity(#maturity) → Assessment(#assessment) → Closing(#closing).
- `src/components/showcase/NavRail.tsx` — desktop side dot nav + mobile bottom pill nav.
- `src/components/showcase/PhoneFrame.tsx` — reusable phone-mockup wrapper for capability chat bubbles.
- Data-driven content in `src/lib/data/`: metrics.ts (4 real user-provided industry stats),
  maturity.ts (5 maturity levels: reactive → orchestrated → unified → ai-assisted → autonomous),
  capabilities.ts (5 scripted chat mockups: ConversationRelay, Conversations Classic, RCS, WhatsApp,
  Group Messaging — these are STATIC/scripted illustrations, not live sends), quiz.ts (5-question
  self-assessment, 1-5 score per option, average score maps to maturity level index).

## Live functional demos (real API calls, not mocks)
- `src/components/showcase/VerifyDemo.tsx` — real Twilio Verify OTP via `/api/verify/start` and
  `/api/verify/check` (uses `src/lib/twilio.ts` client with API_KEY/API_SECRET, `src/lib/phone.ts`
  E.164 formatter). Custom backend pattern (not RAMP).
- `src/components/showcase/SegmentDemo.tsx` — fires real `analytics.track()` events via
  `src/lib/segment.ts` (AnalyticsBrowser singleton, NEXT_PUBLIC_SEGMENT_WRITE_KEY).
- `src/components/SegmentProfileWidget.tsx` — floating bottom-right widget (recolored to brand:
  neptune button, deepspace/mint styling) hitting `/api/segment-profile` which proxies Segment
  Profiles API (SEGMENT_SPACE_ID + SEGMENT_PROFILE_API_KEY).
- `src/components/showcase/AiConcierge.tsx` — real WebSocket chat client connecting to the existing
  `/server` TAC backend at `NEXT_PUBLIC_VOICE_SERVER_URL` (converted http→ws, path `/ws/transcripts`).
  Sends `{type:'identify'}` then `{type:'chat_message', text, conversationId, userEmail}`; listens
  for `conversation_started` and `transcript` events. Shows "deploy to activate" message if
  `NEXT_PUBLIC_VOICE_SERVER_URL` is unset. Random guest email generated inside `useEffect` (not
  during render) to satisfy the `react-hooks/purity` lint rule.
- Did NOT build new WebRTC token routes — reused the existing TAC server's voice/chat/SMS channels
  instead of building a separate `/api/token` + Twilio Voice SDK flow, since `/server` already had
  a full conversational agent.

## Env vars added this session
- `NEXT_PUBLIC_VOICE_SERVER_URL` = prospective Railway URL (from chat metadata `prospectiveRailwayUrl`)
  — needs to work once the app is deployed; used client-side to build the WS URL for AiConcierge.
All other required vars (TWILIO_ACCOUNT_SID/API_KEY/API_SECRET, TWILIO_VERIFY_SID, TWILIO_PHONE_NUMBER,
SEGMENT_SPACE_ID, SEGMENT_PROFILE_API_KEY, NEXT_PUBLIC_SEGMENT_WRITE_KEY) were already pre-configured.

## Explicit scope decisions (per user's approval reply)
- No industry/vertical selector in this pass (Mariana Tek only) — flagged as a fast-follow; user
  mentioned FieldEdge and ServiceAutopilot as other candidate Xplor brands for that later.
- "The Opportunity" / story section (`StorySection.tsx`) is an intentionally labeled PLACEHOLDER
  3-column narrative (Mariana Tek / Studio / Member value story) — user said they don't have the
  final narrative yet.
- Maturity framework content was designed by the agent (user said they *might* share reference
  screenshots later to refine visuals — none provided yet).
- Real industry metrics used in Hero section were provided directly by the user (not placeholders):
  +2,000% prospect conversion, +990% lead capture via AI agents, +25% conversion uplift, +45%
  retention uplift — see `src/lib/data/metrics.ts` for exact copy.

## Session 4 — Major revision: fix runtime errors, Barry's rebrand, remove Segment, new architecture section
The 3 pasted runtime errors were all `TypeError: Failed to fetch` from `@segment/analytics-next`'s
delivery/flush queue (segmentio fetch-dispatcher) — caused by the Segment beacon fetch being
blocked (likely a browser extension) in the WebContainer preview. Root-caused to Segment usage
itself, and the user separately asked to remove Segment from the narrative, so the fix was to
remove Segment entirely rather than patch around the blocked fetch.

**Segment removal**: `src/lib/segment.ts`, `src/components/AnalyticsProvider.tsx`,
`src/components/SegmentProfileWidget.tsx`, `src/components/showcase/SegmentDemo.tsx`, and
`src/app/api/segment-profile/route.ts` were all overwritten as inert stubs (can't delete files —
`rm` is forbidden by the runShell tool). `@segment/analytics-next` was removed from
`package.json` dependencies (nothing imports it anymore). `layout.tsx` no longer renders
`AnalyticsProvider`/`SegmentProfileWidget`. `LiveDemosSection` dropped the Segment demo card and is
now a 2-column grid (AI Concierge + Verify). Segment env vars (`SEGMENT_SPACE_ID`,
`SEGMENT_PROFILE_API_KEY`, `NEXT_PUBLIC_SEGMENT_WRITE_KEY`) were left registered/untouched (harmless,
just unused) — no tool exists to unregister env vars.

**Replaced with a new "How Does It Work" section** (`HowItWorksSection.tsx` + `lib/data/architecture.ts`,
inserted between Capabilities and Maturity, id `#how-it-works`): a vertical reference-architecture
diagram — Member → Barry's site/app → **BMS Platforms** (chip row: Mariana Tek [active] + Xplor
Growth, ClubReady, FieldEdge, "+more" — illustrating one harness connecting to MANY BMS platforms,
per explicit user correction) → **Centralized AI Harness** (described as connecting OUT to multiple
BMS systems and DOWN into TAC — explicitly NOT the same thing as TAC, per user correction: "TAC is
not THE harness") → **Twilio Agent Connect (TAC)** → **Twilio Platform** (chip row: Conversations,
Memory, Conversational Intelligence (CINTEL), Enterprise Knowledge, Voice & Messaging, Verify).
Includes a disclaimer that it's an illustrative reference architecture, not a certified BMS
integration list. `Connector`/`ChipRow` helper components live inline in that file (simple CSS
lines, no SVG/new deps).

**Barry's rebrand** (real brand colors/copy pulled from fetching barrys.com): the illustrative
Mariana Tek customer changed from generic "Mariana Tek Demo Studio" to **Barry's** everywhere —
`PhoneFrame.tsx` chrome now shows a red "B" badge + "Barry's" label + small "Powered by Mariana
Tek" caption (was "MT"/Mariana Tek); `capabilities.ts` messages rewritten with Barry's-specific
scenarios (Run/Lift, Red Room, Double Floor, Soho location); `StorySection.tsx` middle column
renamed "Barry's"; `ClosingSection.tsx` copy updated ("Barry's is the proof point running on
Mariana Tek today..."); `AiConcierge.tsx` copy updated. Mariana Tek stays as the BMS/platform name
throughout — only the illustrative end-customer changed.

**Color theme overhaul**: fetched barrys.com and found their real tokens — black background,
white text, signature red `#D6001A`, font Inter. Remapped `globals.css` CSS vars: `--deepspace`
(main bg) went from purple `#220021` to near-black `#0a0a0a`, `--deepspace-light`/`-lighter` to
`#141414`/`#1f1f1f`, `--starwhite` to neutral `#fafafa` (was warm `#fff7f3`). Added new tokens
`--barrys` (`#d6001a`) / `--barrys-hover` (`#ff1f3b`) → Tailwind `bg-barrys`/`text-barrys`/etc.
Kept Neptune Blue/Mint/Xplorange/Sunray/Blush unchanged as the "Mariana Tek/Twilio platform" accent
— deliberately did NOT touch fonts (Poppins/Roboto) or the Neptune-blue accent since the user said
they loved that part. Reused the EXISTING `deepspace`/`starwhite` Tailwind class names everywhere
(no find-replace of classNames needed across components) — only the CSS variable VALUES changed.

**"Source missing" tags** (`SourceMissing.tsx`): per explicit user correction, do NOT add
methodology/"illustrative estimate" explanations — just a small red `[source missing]` tag next to
every quantified metric, to be replaced with real citations later. `hasMetric(text)` heuristic
(`/[$%]|\d+(\.\d+)?x\b/i`) auto-detects which maturity-tile bullets contain a stat (looks for `%`,
`# Project Memory

## App
"Xplor + Twilio | Platform Showcase" — single-page, scroll-snapped interactive presentation.
Framing: shows how Twilio's platform embeds inside Xplor Technologies' ISV brand **Mariana Tek**
(boutique fitness business management software) to power AI-native member experiences. Backend
type: custom (has /server with a pre-existing full TAC voice/chat/SMS AI agent — twilio-agent-connect,
memory, segment tracking, sendgrid email tool — built before this session).

## Brand theme (real Xplor/Mariana Tek tokens, scraped from marianatek.com WP theme CSS vars)
- Deep Space (bg): #220021, light variant #4e324d
- Neptune Blue (primary): #6923f4, hover #9d70f7
- Xplorange (accent): #f44e27
- Supernova Green / "mint" (accent): #74fbd0
- Sunray Yellow: #ecfd91
- Blush Pink: #ff8df4
- Star White (light text/bg): #fff7f3
- Fonts: Poppins (headings), Roboto (body) — loaded via next/font/google in layout.tsx
- Tailwind v4 `@theme inline` tokens added in globals.css: --color-deepspace, --color-neptune,
  --color-neptune-hover, --color-xplorange, --color-mint, --color-sunray, --color-blush,
  --color-starwhite, --color-ink (so `bg-neptune`, `text-mint`, etc. work as Tailwind utilities).

## Structure
- `src/app/page.tsx` — server component, reads `TWILIO_PHONE_NUMBER`, renders `ShowcaseClient`.
- `src/components/showcase/ShowcaseClient.tsx` — 'use client' orchestrator: snap-scroll container,
  IntersectionObserver-driven NavRail, renders all 7 sections in order:
  Hero(#perspective) → Story(#story) → Capabilities(#capabilities) → LiveDemos(#live-demos) →
  Maturity(#maturity) → Assessment(#assessment) → Closing(#closing).
- `src/components/showcase/NavRail.tsx` — desktop side dot nav + mobile bottom pill nav.
- `src/components/showcase/PhoneFrame.tsx` — reusable phone-mockup wrapper for capability chat bubbles.
- Data-driven content in `src/lib/data/`: metrics.ts (4 real user-provided industry stats),
  maturity.ts (5 maturity levels: reactive → orchestrated → unified → ai-assisted → autonomous),
  capabilities.ts (5 scripted chat mockups: ConversationRelay, Conversations Classic, RCS, WhatsApp,
  Group Messaging — these are STATIC/scripted illustrations, not live sends), quiz.ts (5-question
  self-assessment, 1-5 score per option, average score maps to maturity level index).

## Live functional demos (real API calls, not mocks)
- `src/components/showcase/VerifyDemo.tsx` — real Twilio Verify OTP via `/api/verify/start` and
  `/api/verify/check` (uses `src/lib/twilio.ts` client with API_KEY/API_SECRET, `src/lib/phone.ts`
  E.164 formatter). Custom backend pattern (not RAMP).
- `src/components/showcase/SegmentDemo.tsx` — fires real `analytics.track()` events via
  `src/lib/segment.ts` (AnalyticsBrowser singleton, NEXT_PUBLIC_SEGMENT_WRITE_KEY).
- `src/components/SegmentProfileWidget.tsx` — floating bottom-right widget (recolored to brand:
  neptune button, deepspace/mint styling) hitting `/api/segment-profile` which proxies Segment
  Profiles API (SEGMENT_SPACE_ID + SEGMENT_PROFILE_API_KEY).
- `src/components/showcase/AiConcierge.tsx` — real WebSocket chat client connecting to the existing
  `/server` TAC backend at `NEXT_PUBLIC_VOICE_SERVER_URL` (converted http→ws, path `/ws/transcripts`).
  Sends `{type:'identify'}` then `{type:'chat_message', text, conversationId, userEmail}`; listens
  for `conversation_started` and `transcript` events. Shows "deploy to activate" message if
  `NEXT_PUBLIC_VOICE_SERVER_URL` is unset. Random guest email generated inside `useEffect` (not
  during render) to satisfy the `react-hooks/purity` lint rule.
- Did NOT build new WebRTC token routes — reused the existing TAC server's voice/chat/SMS channels
  instead of building a separate `/api/token` + Twilio Voice SDK flow, since `/server` already had
  a full conversational agent.

## Env vars added this session
- `NEXT_PUBLIC_VOICE_SERVER_URL` = prospective Railway URL (from chat metadata `prospectiveRailwayUrl`)
  — needs to work once the app is deployed; used client-side to build the WS URL for AiConcierge.
All other required vars (TWILIO_ACCOUNT_SID/API_KEY/API_SECRET, TWILIO_VERIFY_SID, TWILIO_PHONE_NUMBER,
SEGMENT_SPACE_ID, SEGMENT_PROFILE_API_KEY, NEXT_PUBLIC_SEGMENT_WRITE_KEY) were already pre-configured.

## Explicit scope decisions (per user's approval reply)
- No industry/vertical selector in this pass (Mariana Tek only) — flagged as a fast-follow; user
  mentioned FieldEdge and ServiceAutopilot as other candidate Xplor brands for that later.
- "The Opportunity" / story section (`StorySection.tsx`) is an intentionally labeled PLACEHOLDER
  3-column narrative (Mariana Tek / Studio / Member value story) — user said they don't have the
  final narrative yet.
- Maturity framework content was designed by the agent (user said they *might* share reference
  screenshots later to refine visuals — none provided yet).
- Real industry metrics used in Hero section were provided directly by the user (not placeholders):
  +2,000% prospect conversion, +990% lead capture via AI agents, +25% conversion uplift, +45%
  retention uplift — see `src/lib/data/metrics.ts` for exact copy.

, or an "Nx" multiplier) so the tag is applied without restructuring the bullet data into
{text, metric} objects. Applied to: all 4 Hero metric values (always tagged) and every
studioValue/bmsValue bullet in `MaturitySection.tsx` that matches the heuristic.

**Horizontal-scroll UX fix** (`HorizontalScrollRow.tsx`, new shared component): wraps
CapabilitiesSection's phone-mockup row and MaturitySection's tile row. Breaks out of the section's
side padding via negative margin (`-mx-6 md:-mx-16`) so cards bleed toward the viewport edges
instead of looking clipped inside the `max-w-6xl` container; adds left/right edge fade gradients
(`bg-gradient-to-r/l from-deepspace to-transparent`) and visible circular ‹ › arrow buttons
(desktop only, `scrollBy` 360px) plus a "← swipe to see more →" hint on mobile — makes the
horizontal scroll affordance obvious, which was the user's complaint.

**Maturity tiles**: still locked/dynamic-numbering/drag-and-drop from session 3 (unchanged logic),
now wrapped in `HorizontalScrollRow`. Detail panel's "Value for the Studio" column renamed to
"Value for Barry's (the Studio)". Added a persistent "Try it out ↓" button (scrolls to
`#live-demos`) to EVERY level's detail panel, not just the live one — replacing the old
conditional-only link.

**Section order changed** (in `ShowcaseClient.tsx`): Hero → Story → Capabilities →
**How It Works (new)** → Maturity Framework → **Live Demos (moved, was before Maturity)** →
Assessment → Closing. Live Demos moving after Maturity was an explicit user ask so "Try it out"
CTAs on the maturity tiles make sense scrolling forward.

**CINTEL renaming**: "Conversation Intelligence (CINTEL)" → "Conversational Intelligence (CINTEL)";
"Continuous CINTEL" → "Real-Time Conversational Intelligence" — updated in `maturity.ts` (Level 2
techStack/description, Level 5 techStack/description/useCase) and `architecture.ts`.

Build after this session: client bundle actually shrank (150kB → 120kB First Load JS) since the
Segment SDK is no longer bundled — good confirmation the removal was clean.

## Session 5 — Realism pass (logo, branded calling, RCS carousel), scroll-bleed fix
User asked whether "vibes" natively supports live Branded Calling / RCS demos. Researched via
Twilio MCP docs before answering — both require real-world business/brand registration that can't
be provisioned in this session:
- **Branded Calling (Voice Integrity)**: needs an approved Trust Hub Business Profile + EIN +
  signed LOA + SHAKEN/STIR, ~7 business day carrier review.
- **RCS Business Messaging**: needs a Google-approved RCS Sender (business docs, opt-in/opt-out
  policy, hosted demo video), typically 4–6 weeks.
Decision: be transparent about this rather than claim it's "live" — added a `note` field on
`Capability` (`lib/data/capabilities.ts`) shown as an inline ⚠ caveat under the Branded Calling and
RCS cards in `CapabilitiesSection.tsx`, explaining what registration is required before either
could run on a real device. These stay as realistic-looking mockups, not live sends.

**`BarrysLogoMark.tsx`** (new): replaces the crude flat red "B" circle everywhere — a small SVG
(double chevron + star, loosely modeled on Barry's real mark) inside a black rounded-square badge,
used in `PhoneFrame`'s chat header, the call-screen avatar, and the RCS header.

**`PhoneFrame.tsx` rewritten** as `'use client'` (needed for RCS carousel state) with three
variants split into sub-components: `CallScreenView` (branded calling — bigger logo, verified
checkmark badge instead of plain outline, native-style green/red accept-decline buttons),
`RcsView` (new — faithful recreation of a real RCS conversation: back-chevron + unread-count
bubble, centered logo/name/chevron, "Text Message · RCS" timestamp caption, intro bubble, a card
with drop-shadow-stacked effect showing a real Pexels instructor photo + title/subtitle + "N of 3"
counter, a blue-tinted quick-reply bubble, and "Don't recognize this business? Report Spam" fine
print — auto-advances through 3 cards every 2.6s via `setInterval`), and the default chat-bubble
view (unchanged, now uses `BarrysLogoMark`).

**`lib/data/capabilities.ts`**: added `RcsCard`/`RcsData` types and a `note` field on
`Capability`. The RCS entry now has `type: 'rcs'` + real `rcs.cards` data (3 class cards: Mike 4pm,
Ajay 6pm, Sarah 7pm HIIT — matching the exact copy from the user's screenshots) with real Pexels
stock photos (fetched via `searchStockImages`: gym-trainer portraits for Mike/Ajay, confident-woman
gym portrait for Sarah — chosen instead of generic silhouettes for realism, since no video/image
upload capability exists for this tool).

**`HorizontalScrollRow.tsx` fixed**: the previous version's fade-gradient/arrow-button width (`w-24`
desktop) was WIDER than the scroll track's inner edge padding (`px-16`), so the fade+button zone
visually covered part of the first/last card — this was the "icons falling off" bug. Fixed by
making the fade width and the inner scroll padding use the EXACT same Tailwind value (`w-12
md:w-20` fade ⇔ `px-12 md:px-20` inner padding) so cards never sit under the overlay, and reduced
the outer negative-margin bleed (`-mx-16` → `-mx-10` on desktop) per explicit user feedback that it
was bleeding "too far" edge-to-edge — now it bleeds modestly past the section's text column instead
of all the way to the viewport edge.
- `react-hooks/set-state-in-effect`: can't call an async function that synchronously calls setState
  as the first line, directly inside a useEffect body. Fixed in SegmentProfileWidget by wrapping the
  `fetchTab(activeTab)` call in `setTimeout(..., 0)` inside the effect.
- `react-hooks/purity`: can't call `Math.random()` inside a `useRef()` initializer (runs during
  render). Fixed in AiConcierge by initializing `emailRef` to `''` and generating the random guest
  email inside a `useEffect` instead.
- Webcontainer sometimes throws a transient `Cannot find module './548.js'` error during
  "Collecting page data" — unrelated to code, resolved by re-running `npm run build` once.

## Session 2 — Maturity framework rebuild (6 levels, drag-and-drop, real Xplor L1/L2 reality)
User provided reference screenshots (tile-based 6-level "Solution Maturity Model" UI) and two
detailed tables mapping each level to Twilio tech, a studio use-case ("Barry's"), studio business
value, and BMS (Mariana Tek) business value. Also gave explicit correction: Level 1 must reflect
that most Xplor brands only have messaging today (some forward calls to a separate, disconnected
business line); Level 2 must be specifically "SMS + 2-way voice on the SAME phone number" (not a
separate line) — the single highest-leverage next step — plus CINTEL (call summaries/sentiment/
webhook dispositions to BMS/CRM) and Enhanced Branded Calling + Voice Insights (best time-of-day to
call for answer rate/ROI).

Rebuilt to 6 levels in `src/lib/data/maturity.ts` (interface changed: removed `products`, added
`techStack`, `useCases: {title, description}[]`, `studioValue: string[]`, `bmsValue: string[]`,
optional `prerequisite`/`prerequisiteNote`/`live`):
1. Foundational SMS Messaging (messaging-only reality + optional disconnected call-forwarding line)
2. Dual-Channel Voice & SMS Consolidation (same-number voice+SMS, CINTEL, Enhanced Branded Calling,
   Voice Insights) — flagged `prerequisite: true` with a note that it's usually required before
   Levels 3–5 unless replaced by Level 6's Flex SDK embed
3. Omnichannel Text Conversations (Conversations Classic: SMS/MMS/WhatsApp/RCS/FB Messenger)
4. Text-Based AI Agents & Knowledge Base (Conversation Memory, Enterprise Knowledge RAG, RCS, BMS
   Surface Sync)
5. Autonomous Multi-Channel Voice AI (Conversation Orchestrator, ConversationRelay, Continuous
   CINTEL, Voice Insights) — `live: true`, ties directly to the AiConcierge live demo
6. Embedded Omnichannel Architecture (Flex SDK, TaskRouter, Twilio Studio, Serverless Functions) —
   envelops Levels 1–3, alternate path to voice+SMS consolidation

All use-case/value bullet content was adapted near-verbatim from the user's own tables (renamed
"Barry's" references to keep the existing "Studio"/Mariana Tek framing already used elsewhere in
the app, e.g. "Value for the Studio" vs. "Value for Mariana Tek (the BMS)" — avoided using the
literal name "Barry's" to stay consistent with the rest of the demo's generic studio references).

`src/components/showcase/MaturitySection.tsx` was rewritten to render the 6 levels as **drag-and-
drop reorderable tiles** using the native HTML5 Drag and Drop API (no new dependency added —
`draggable`, `onDragStart`/`onDragOver`/`onDrop`/`onDragEnd` on each tile card) plus `←`/`→` buttons
as an accessible/touch fallback for reordering. Clicking a tile (not dragging) sets it as the
selected/expanded level, shown in a detail panel below with tech-stack chips, 3 use-case cards, and
two value columns (Studio vs. BMS). A "Reset order" link appears once the user has reordered. Level
2's tile shows an inline ⚠ prerequisite note. No hard validation blocks reordering — the
prerequisite is communicated via copy only (keeps the demo interaction simple while still conveying
the intended constraint).

`src/lib/data/quiz.ts` — expanded every question from 5 to 6 options (added a 6th "embedded natively
via Flex SDK" option per question, score 6) so the self-assessment average maps cleanly onto all 6
maturity levels. `AssessmentSection.tsx` updated to render `result.techStack` instead of the old
`result.products` field name.

`src/lib/data/capabilities.ts` / `PhoneFrame.tsx` — added a new "Branded Calling & Voice Insights"
capability card (`type: 'call'`) to visually demonstrate the Level 2 concept in the Embedded
Capabilities section. `PhoneFrame` now supports two render modes: chat bubbles (existing) or a new
`callScreen` mode (incoming-call UI with verified caller name/reason, Voice Insights banner, and
accept/decline buttons) — driven by an optional `callScreen` prop `{ callerName, reason, insight }`.

## Session 3 — Maturity tile polish (locking, dynamic numbering, chip cleanup)
- `LOCKED_ID = 'foundational-sms'` in `MaturitySection.tsx` — Level 1 tile is now permanently
  pinned at index 0: `draggable={false}` on it, drag handlers early-return if `draggedId ===
  LOCKED_ID` or `targetId === LOCKED_ID`, and `moveTile()` refuses to move anything into index 0.
  Locked tile shows "🔒 Always first" instead of reorder arrows/drag hint.
- Tile and detail-panel "Level N" labels are now computed dynamically from the CURRENT `order`
  array position (`orderedLevels.findIndex(...) + 1`), not from the static `level.level` field in
  the data file. The data's `level` field still exists (1–6, canonical/default order) but is no
  longer directly rendered anywhere in the interactive tiles — only used for the initial default
  `order` array and by the (separate, non-interactive) assessment quiz result, which intentionally
  shows the canonical static level number since it's not tied to tile drag state.
- Removed the "+N" overflow chip pattern entirely — tiles now render the FULL `techStack` array
  wrapped with `flex-wrap` instead of `.slice(0, 2)` + a "+N" badge (user feedback: looked bad).
- Rewrote `prerequisiteNote` copy on the dual-channel-voice level, and the section's top ⚠ note, to
  reference levels BY NAME ("the AI Agent and Autonomous Voice levels", "the Embedded Omnichannel
  (Flex SDK) architecture") instead of hardcoded numbers like "Level 3–5" / "Level 6", since those
  numbers can now shift when tiles are reordered.
- Removed a hardcoded "Level 5" from `AiConcierge.tsx`'s badge (now reads "AI Concierge · Autonomous
  Voice AI") for the same reason — no static level numbers outside the canonical data file / static
  assessment result panel.
- Circular level-number badge style was added to each tile (colored border, filled solid when tile
  is selected) as a deliberate visual-polish restoration — user mentioned liking elements from an
  earlier iteration but didn't have a screenshot to share; this was a good-faith improvement, may
  need further iteration if user has more specific asks.

## Session 6 — Move/label How It Works as WIP, real RCS content, better photos
- **Section reorder**: `HowItWorksSection` moved from between Capabilities/Maturity to AFTER
  Assessment (order now: Hero → Story → Capabilities → Maturity → Live Demos → Assessment → **How
  It Works** → Closing) in `ShowcaseClient.tsx`. Nav label changed to "How It Works (WIP)".
- **Labeled as WIP/placeholder**: user said the architecture content "is not correct at all right
  now" — added a visible `⚠ WIP / PLACEHOLDER — not accurate yet` badge at the top of
  `HowItWorksSection.tsx`, an inline sentence saying it's a rough sketch to be corrected, and
  updated the bottom disclaimer to match. Content itself was NOT reworked this session — only
  relabeled — since the user hasn't yet said what's specifically wrong with it.
- **RCS card content corrected** (`lib/data/capabilities.ts`, `rcs.cards`) to match the user's real
  class data: "RUN x LIFT: Full Body–Upper Focus (50 min)" / "w/ Charlie C.", "LIFT: Full
  Body–Upper Focus (50 min)" / "Jordan S.", "RUN x LIFT: 200M Sprint Challenge – Full Body" /
  "Jess F." (title = class name, subtitle = instructor — previously both were the same duplicated
  string).
- **RCS photos**: user attached 3 real reference photos (a woman headshot for Charlie, two men in
  black "BARRY'S" branded t-shirts for Jordan/Jess) directly in chat, but there is NO tool available
  to download/save chat-attached images into the project — only `searchStockImages` (Pexels) or
  assets the user uploads themselves via the Dashboard's Assets tab (Vercel Blob) with a resulting
  URL I could reference. Used `searchStockImages` to find the closest visual matches instead (woman
  brown-hair headshot for Charlie; two different men in dark t-shirts for Jordan/Jess). **If the
  user wants the exact photos they attached, they need to upload them via Dashboard → Assets and
  share the resulting URLs** — flagged this to the user in the chat response.

## Session 13 — Emerald Fitness "Guided Member Journey" (Acts 0–4), user's OWN Twilio account
User pasted a full 12-step narrative script (Maya, 31, Fort Worth, West 7th studio) and explicitly
asked for a NON-tabbed, narrative-guided interface — "not simply a single pane of glass with
open-ended outcomes". Planning-first turn: asked 13 follow-up questions before building.

**Credentials changed mid-session**: chat switched from shared Vibes creds to the user's OWN
account `AC6b1d68e06745b643d5e145e352eeb464`. New `TWILIO_PHONE_NUMBER=+18668144982` (toll-free),
new `TWILIO_MEMORY_STORE_ID=mem_store_01kfy8jrdpf7h9x8wsmq7r1mh2`, new conversation config,
`TWILIO_VOICE_PUBLIC_DOMAIN` now set to the Railway host. Verify/SendGrid/Segment vars came back EMPTY.

**Twilio provisioning done via createOrModifyTwilioResource (all on the user's account):**
- Verify service created: `TWILIO_VERIFY_SID=VA02c8928dbf62eba6224619ec2e553d0c`. GOTCHA: Verify
  `FriendlyName` max length is short — "Emerald Fitness Member Verification" (35 chars) was
  rejected with error 60200; "Emerald Fitness" worked.
- Messaging Service "Emerald Fitness" created: `EMERALD_MESSAGING_SERVICE_SID=MG70925a5d4c282605f5f953f773c3c11a`,
  `InboundRequestUrl` → `<railway>/journey/inbound`, `UseInboundWebhookOnNumber=false`.
  Contains the RCS channel sender + the toll-free number (RCS-first with automatic SMS fallback).
- The toll-free had to be REMOVED from "Low Volume Mixed A2P Messaging Service" first (error 21712
  — a number can only live in one Messaging Service).
- RCS sender chosen by the user: **`rcs:riverside_medical_group_6kyke0xo_agent`** (SID
  `XE322f2a124c112233a1887e12b2bcb5d0`), registered as `EMERALD_RCS_SENDER_ID`. Status DRAFT —
  that's FINE and intended, it delivers to allowlisted test devices only, and the user's handset is
  already a tester. The user renames it to "Emerald Fitness" + sets logo/colour in the Console
  themselves — **the `createOrModifyTwilioResource` tool CANNOT update it: its `body` only accepts
  flat scalar values, and the v2 Channels/Senders update needs a nested `profile` object.**
- Phone number `PNbd992392196fc942be68c5e9c7648198` renamed "Emerald Fitness — West 7th",
  `VoiceUrl` → `<railway>/twiml` (was pointing at an old bpwilke-included-health-demo Vercel app).
- New env vars: `EMERALD_MESSAGING_SERVICE_SID`, `EMERALD_RCS_SENDER_ID`, `EMERALD_STUDIO_PHONE`,
  `NEXT_PUBLIC_EMERALD_STUDIO_PHONE`, `TWILIO_VERIFY_SID`, `NEXT_PUBLIC_VOICE_SERVER_URL`.

**Researched facts worth not re-discovering:**
- **Twilio Lookup has NO RCS capability field.** Live 400 response lists the only valid `Fields`:
  validation, caller_name, sim_swap, call_forwarding, line_status, line_type_intelligence,
  identity_match, reassigned_number, sms_pumping_risk, phone_number_quality_score, pre_fill.
  There is also no public "is this number RCS capable" endpoint. So the signup screen shows REAL
  Lookup (valid / line type / carrier / country) and reports RCS as "RCS-first, SMS fallback" for
  mobile lines; the CONFIRMED channel is resolved afterwards from the status callback's `From`
  (starts with `rcs:` → RCS, `+` → SMS). Deliberate + labelled honestly in the UI.
- `twilio/carousel`: 2–10 cards, **1–2 buttons per card**, body text is DROPPED on RCS.
- `twilio/card` on RCS: title/body/media/actions; QUICK_REPLY → SuggestedReply. With media and >4
  buttons the overflow becomes a chip list; with NO media it renders as a chip list — so the
  reminder (3 chips) and post-class (6 chips) templates intentionally omit media.
- QUICK_REPLY button `title` max 20 chars; URL title max 25. Inbound taps arrive as `ButtonText` +
  `ButtonPayload` on the webhook.
- Content template variables ARE supported in quick-reply `title` and `id`, which is what makes the
  reusable `emerald_slot_picker_v1` template work (5 slots via vars 2–11).
- Memory store `mem_store_01kfy8...` already has a `Contact` trait group whose `phone` trait has
  `idTypePromotion: "phone"` — so `POST /v1/Stores/{id}/Profiles` with
  `traits.Contact.phone` auto-creates the phone identifier; no separate Identifiers call needed.
  Memory has NO event stream — events are written as **Observations**
  (`POST .../Observations` with `{observations:[{content, occurredAt, source}]}`; occurredAt and
  source are REQUIRED). Delete is `DELETE /v1/Stores/{id}/Profiles/{profileId}`.
- **No Flex instance on either account** (`flex-api.twilio.com/v1/Configuration` → 404 on both the
  shared Vibes account and the user's own). Act 4 step 12 is therefore a Flex-SHAPED front-desk
  desktop inside the demo; the user said they'll connect their own Flex later.

**New server code — `/server/src/journey/` (7 modules):**
- `script.ts` — single source of truth: BRAND/PERSONA/EVENTS, deterministic 14-day class schedule
  generator (5 fixed times × 5 class types × 5 instructors, seeded spot counts, starts TOMORROW so
  nothing is ever in the past), `nextWeekday()`, WELCOME_CARDS (5), DRINKS (3, Pexels photos), and
  the 13 BEATS (setup, signup, welcome, book-1, reminder, fuel, post-class, book-2, ai-rebook,
  after-hours, voice-hold, voice-callback, flex) each with narration + mechanic + action/waiting.
- `state.ts` — in-memory `JourneyState` keyed by phone (beat pointer, `completed[]`, classes,
  membership, messages, events, transcript, callStatus/callCount, escalation) + `getAnyState()`
  which webhooks use since there's only ever one live run.
- `bus.ts` — `/ws/journey` WebSocket; `pushState()` broadcasts the WHOLE state (UI never guesses).
- `memory-profile.ts` — creates the `Membership` trait group on demand, create/lookup/patch/delete
  profile, `writeObservation`, `fetchProfileSnapshot` (traits + observations + summaries).
- `content.ts` — creates/caches 6 Content Templates by friendly_name (`emerald_*_v1`), paging
  `GET /v1/Content` to reuse rather than duplicate on every boot.
- `send.ts` — sends via `messagingServiceSid` (never `from`), attaches `statusCallback`, and mirrors
  every send into `state.messages` so the on-screen phone thread is a real mirror.
- `engine.ts` — all beat actions + `fireEvent` (addEvent + Memory observation + push).
- `inbound.ts` — payload router (`wc_*`, `rem_*`, `drink_*`, `rate_*`, `slot_*`, `hold_*`) plus
  keyword fallbacks for SMS, and the **scoped rebooking agent** (gpt-4.1-mini, only two tools:
  `show_open_times`, `move_booking`; prompt forbids listing times in prose or confirming without
  the tool).
- `voice.ts` — **beat-scoped** voice agent: `holdPrompt` (Act 3) vs `callbackPrompt` (Act 4) chosen
  from `state.beatId`/membership status. Tools: `place_membership_hold` (has a
  `confirmed_out_loud` boolean gate so it refuses to commit before reading dates back),
  `check_payment_method` (flags the expired card), `transfer_to_front_desk`. Hold confirmation RCS
  is sent from `handleJourneyCallEnded` so it lands "as she hangs up", per the script.
- `routes.ts` — `/journey/config|state|slots|lookup|verify/start|verify/check|advance|action|book|desk/claim|reset|profile/delete|inbound|status`
  + a permissive CORS onRequest hook scoped to `/journey`.

**`tac-server.ts` wiring**: `onMessageReady` intercepts `sessionChannel === 'voice'` and routes to
`handleJourneyVoiceTurn` when a journey state exists (returns early, bypassing the generic agent);
`onConversationEnded` calls `handleJourneyCallEnded`; `registerJourneyRoutes(server.fastify)`;
upgrade router now handles `/ws/journey` in addition to `/ws/transcripts`. Messaging deliberately
does NOT go through TAC's SMSChannel — the Messaging Service inbound URL points straight at
`/journey/inbound` for deterministic control.

**Next.js side:**
- `src/app/api/journey/[...path]/route.ts` — thin proxy to Railway (avoids CORS + hides the URL).
  WebSocket connects directly to Railway via `NEXT_PUBLIC_VOICE_SERVER_URL`.
- `src/lib/journey/types.ts` + `use-journey.ts` (hook: config + state + profile + WS with reconnect).
- `src/components/journey/`: `EmeraldMark`, `StoryRail`, `ProfilePane`, `PhoneThread`,
  `SignupStage`, `BookingStage`, `CallStage` (CallPromptStage + LiveCallStage), `DeskStage`,
  `JourneyWorkspace`.
- `src/app/journey/page.tsx` — full-screen workspace (server component → client workspace).
- `src/components/showcase/MemberJourneySection.tsx` — new snap section `#member-journey`,
  inserted AFTER `LiveDemosSection` ("Try It Yourself") in `ShowcaseClient.tsx`, nav label
  "Guided Member Journey". Links to `/journey`.
- `globals.css`: added `--emerald`/`-deep`/`-glow`/`-ink`/`-panel` tokens + Tailwind `@theme`
  mappings, and `beat-pulse` / `waiting-sweep` / `ring-pulse` animations.

**Layout decisions**: 3 panes — Story Rail (352px, one beat active, later beats visibly `locked`),
Stage (beat-driven surface + the phone thread ALWAYS visible beside it, because the Act 3 hold
confirmation must be seen arriving mid-call), Unified Profile (330px). The phone is hidden only on
the `desk` beat. `bookingRound === 2` pins the booking mini-site to `config.thursday` so her
"can't make Thursday" line always lands.

**Scope decisions per the user's approval reply**: only this new section is Emerald Fitness-branded
(the rest of the app stays Barry's); RCS sender is the renamed Riverside one; step 5 event is
"Fuel Bar Order Placed"; the rebook fires BOTH "Class Cancelled" and "Class Booked"; step 12 fires
"Flex Escalation"; no CDP/Segment — the on-screen profile is a proxy for the customer's own CDP.

**Lint gotcha (new rule)**: `react-hooks/immutability` — "Cannot reassign variable after render
completes". The classic `let lastAct = ''` mutated inside `.map()` to detect group headers is now a
build error. Fixed by deriving it without mutation:
`beats.map((beat, i) => ({ beat, showActHeader: i === 0 || beats[i-1].actLabel !== beat.actLabel }))`.
Moving the mutation into a separate pre-render `.map()` does NOT satisfy the rule.

## Session 14 — ROOT-CAUSED the RCS-falls-back-to-SMS bug, trait cleanup, voice greeting

**THE RCS BUG (definitive, tested live against the user's account):** the demo was configured with
RCS sender `rcs:riverside_medical_group_6kyke0xo_agent`, but the user's handset (`+18324654325`)
has **never accepted the tester invite for that sender**. Every RCS attempt returned
**error 63035** ("The RCS sender does not have permission to send to this recipient") and the
Messaging Service silently retried over SMS — which is why every message in session 13 arrived as
plain SMS with the `twilio/text` fallback body.

Proven by forcing the channel (`From: rcs:<sender>` + `To: rcs:+1...`; note `To` MUST be
`rcs:+1...` or you get error **21910** "Invalid From and To pair"):
- `rcs:riverside_medical_group_6kyke0xo_agent` → **failed, error_code 63035**
- `rcs:wilke_worldwide_gnt58yzl_agent` (the user's OWN sender, SID `XE8358dad947fe1f77425baf05a91f3519`,
  status DRAFT) → **delivered**, `from: rcs:...`, `to: rcs:+1...`
- Then re-sent the real `emerald_welcome_carousel_v1` template through the Messaging Service →
  **delivered as RCS**, `from: rcs:wilke_worldwide_gnt58yzl_agent`, `num_media: 5` (all 5 cards).

So: **iPhone/iOS 18 RCS was never the problem.** Do not chase iOS support next time — check the
tester allowlist per sender first.

**Twilio account changes:**
- Removed `XE322f2a...` (Riverside) from Messaging Service `MG70925a5d4c282605f5f953f773c3c11a`.
- `XE8358dad9...` (Wilke Worldwide) was in `MG5cd30cd322befba7976c4b8f7a391613` ("Low Volume Mixed
  A2P") — a channel sender can only be in ONE service (error 20409 "This sender is already used by
  a Service"), so removed it there and added it to the Emerald Fitness service.
- `EMERALD_RCS_SENDER_ID` → `rcs:wilke_worldwide_gnt58yzl_agent`.
- New env var `EMERALD_VOICE_GREETING`.
- NOTE: `createOrModifyTwilioResource` returns `{"error":"Unexpected end of JSON input"}` for
  DELETE on ChannelSenders — that's a 204 with an empty body, the delete DID succeed. Verify with
  a follow-up GET rather than retrying.
- Still outstanding for the user (manual, Console only): rebrand the Wilke Worldwide sender's
  display name/logo/accent to Emerald Fitness. The nested `profile` object still can't be set via
  the flat-scalar-only `createOrModifyTwilioResource` body.

**New `server/src/journey/rcs-health.ts`** — `checkRcsHealth()` (60s cache + `invalidateRcsHealth()`):
lists `/v2/Channels/Senders?Channel=rcs` to confirm the configured sender exists and grab its
`profile.name` / `status`, and lists the Messaging Service's `ChannelSenders` to confirm it's in
the sender pool. Returns `{senderId, displayName, senderStatus, inSenderPool, ok, problem, hint}`.
It deliberately does NOT try to verify the tester allowlist — there is no Twilio API for the RBM
tester list, which is exactly why the 63035 failure has to be caught on the delivery receipt.
Surfaced via `/journey/config` (`rcs` field) + new `POST /journey/rcs-check`.

**`send.ts` rewritten** — no more optimistic-and-never-corrected `channel: 'rcs'`:
- `JourneyMessage` (both `server/src/journey/state.ts` and `src/lib/journey/types.ts`) gained
  `channelConfirmed`, `deliveryStatus`, `fellBackToSms`, `errorCode`, `fallbackReason`.
- `applyDeliveryFacts(message, {from, status, errorCode})` is the single place that decides the
  real channel (`from` starts `rcs:` → RCS confirmed; starts `+` → SMS fallback). Exported and
  reused by `/journey/status`.
- `fallbackReasonFor(code)` maps 63035/63036/63106/63034 to plain English.
- `pollForChannel()` — because the status webhook can't be relied on (Railway may be unreachable),
  polls `messages(sid).fetch()` at 4s/6s/10s until `channelConfirmed`. Note: a messaging-service
  send returns `from: null` at create time, so the channel is ONLY knowable after the fact.
- `logInbound()` now takes the raw `from` so an inbound `rcs:` address is recorded truthfully.

**`/journey/status`** now reads `ErrorCode` too and delegates to `applyDeliveryFacts`.

**UI**: `PhoneThread.tsx` got a `DeliveryBadge` per bubble — "sending…" until confirmed, a blue
`RCS` pill when genuinely RCS, an amber `⚠ SMS fallback · <code>` pill plus the reason line when it
fell back; footer swaps the "report spam" line for a fallback count. `JourneyWorkspace.tsx` got an
`RcsChip` in the header (tooltip explains DRAFT senders only reach accepted testers) and an amber
banner when `config.rcs.ok` is false.

**PATIENT/APPOINTMENT traits removed**: they were real leftover trait groups in the shared Memory
store from the Included Health demo. Fixed with an allowlist in BOTH places — `isVisibleGroup()`
in `memory-profile.ts`'s `fetchProfileSnapshot` (server) and in `ProfilePane.tsx` (client guard so
it's right even before a Railway redeploy). Allowed groups: `Contact`, `Membership`.

**Voice greeting**: `TACServer` accepts `conversationRelayConfig: Partial<Omit<ConversationRelayConfig,'url'>>`
— set `welcomeGreeting` (from `EMERALD_VOICE_GREETING`, defaulting to "Thank you for calling
Emerald Fitness on West 7th. How can I help you today?") and `welcomeGreetingInterruptible: 'speech'`
in `tac-server.ts`. Both `holdPrompt` and `callbackPrompt` step 1 in `journey/voice.ts` were
rewritten (plus a paragraph in `VOICE_STYLE`) so the agent knows she's ALREADY been greeted and
must not greet/re-introduce/ask "how can I help" again.

**Tooling gotchas**: `getFileContents` cannot read anything under `node_modules` (returns not
found) even when `ls` shows the file — write a small `.cjs` script and run it with `node` instead.
`node -e` with a TS-ish string fails in this webcontainer ("Invalid or unexpected token"), so use a
file. `/home/project/.utils/inspect-types.js` does NOT exist in this project.

## Session 17 — Voice agent jumped to the hold conclusion from background noise

User reported the Act 3 agent decided she was calling to place a hold before she said anything — a
noisy room got transcribed and the model ran with it. User pushed back on the first plan as
"probably overkill" and asked ONLY that it not jump to the hold conclusion until asked, so the
scoped-out items (a transcription `hints` vocabulary list, a gate on the Act 4 callback tools) were
deliberately NOT built.

**ConversationRelayAttributes has real noise knobs** (read from the TAC `.d.ts`, full list:
`url, welcomeGreeting, welcomeGreetingInterruptible, transcriptionProvider, transcriptionLanguage,
speechModel, ttsProvider, ttsLanguage, voice, elevenlabsTextNormalization, interruptible,
interruptSensitivity, dtmfDetection, hints, reportInputDuringAgentSpeech, partialPrompts,
profanityFilter, preemptible, language, debug, intelligenceService, conversationConfiguration`).
Set in BOTH places the relay config is built (`TACServer` constructor config AND the custom
`/twiml` route in `tac-server.ts` — they must stay in sync):
- `welcomeGreetingInterruptible: "none"` (was `"speech"` — noise was cutting the greeting off and
  that truncation became a bogus prompt)
- `interruptible: "speech"`
- `interruptSensitivity: "low"`
- `reportInputDuringAgentSpeech: false`

**`journey/voice.ts`:**
- `isNoise(message)` — `NOISE_ONLY` (`/^[\s.,!?—–-]*$/`) + `FILLER_ONLY` (uh/um/hmm/mm/ah/oh/eh/huh).
  `handleJourneyVoiceTurn` returns `undefined` immediately for those, so the agent stays silent
  instead of answering something she never said. Deliberately kept tiny — no separate module.
- `memberAskedForHold(state)` — scans `state.transcript` for `role === "member"` lines matching
  `HOLD_REQUEST` (hold/pause/freeze/suspend/take a break/stop my membership/out of town/travelling).
- `place_membership_hold` gained a required `member_asked_in_their_words: string` input AND refuses
  outright unless `memberAskedForHold(state)` is true, returning a directive telling the agent to
  ask her what she's calling about. Belt and braces: the model must quote her, and the server
  independently verifies the transcript.
- `holdPrompt` rewritten to 6 steps: step 1 is now an explicitly NEUTRAL one-liner ("floor is closed
  but I can help from here") with an explicit ban on naming a reason, and step 2 says to ask her to
  repeat herself if the utterance was unclear rather than filling in the blank. Added hard rules:
  "NEVER be the first one to bring up a hold, a pause, a freeze, a suspension, cancelling, travel or
  her card" and "If you are not certain she asked for a hold, you have not heard her ask."
- `callbackPrompt` step 2 got a one-clause addition ("If she has not asked for that yet, just listen
  and answer what she actually said") — no tool gate added there, per the user's scope pushback.

## Session 16 — RCS image fix (immutable templates!), REAL Flex plugin built + released

**ROOT CAUSE of "Parking and Get Fuel at the Bar images no longer render":** two Pexels photos
(`29964720` parking, `27349280` fuel bar) stopped being served. **The critical, non-obvious part:
Twilio Content Templates are IMMUTABLE** — `content.ts`'s `ensure()` reuses by `friendly_name`, so
editing `WELCOME_CARDS[].media` in `script.ts` does NOTHING. You MUST bump the version suffix in
`TEMPLATE_NAMES` to publish a new template. Did: `welcome: emerald_welcome_carousel_v1` →
`emerald_welcome_carousel_v2`. New photos: parking `13389484`, fuel `3794784` (chose LOW-numbered/
older Pexels IDs deliberately — the 3 that kept working were `4943933`/`7031705`/`4959807`, all old;
the 2 that broke were both new high-numbered IDs. Newer Pexels uploads seem to get pulled more).
Pre-created the v2 template via a one-off node script (`create-welcome-template.cjs`, now blanked):
`HX7bb758937618dfce3758fea0f39c0a24`. That script also GET-verified every media URL returns
`image/jpeg` with a sane byte count before baking it in — worth repeating for any future template.
NOTE: `createOrModifyTwilioResource` CANNOT create Content Templates (body is flat scalars only,
Content API needs nested JSON). Use a `.cjs` script that reads `.env` and `fetch()`es with Basic
auth from `TWILIO_API_KEY:TWILIO_API_SECRET` — network egress from the webcontainer works fine.

**FLEX PLUGIN — the registration contract (definitively verified, don't guess again):**
Fetched `https://unpkg.com/@twilio/flex-plugin@latest/dist/lib/flex-plugin.js` — `loadPlugin` is
literally just:
```js
if (Twilio && Twilio.Flex && Twilio.Flex.Plugins) Twilio.Flex.Plugins.init(plugin);
```
It takes the CLASS, not an instance. And the official webpack build marks `react`→`window.React`,
`react-dom`→`window.ReactDOM`, `@twilio/flex-ui`→`window.Twilio.Flex` as EXTERNALS. **Therefore a
hand-written IIFE against those globals is a fully valid Flex plugin bundle — no webpack, no CLI,
no `twilio flex:plugins:deploy`.** This is the key unlock; don't install flex-plugin-scripts in the
webcontainer.

**Hosting:** `PluginUrl` on a PluginVersion can be ANY URL (`Private: false` = Flex fetches it
unauthenticated). Served from **Railway**, not Vercel — Vercel deployment protection would block
Flex's fetch of a `public/` asset. Route added in `tac-server.ts`:
`GET /flex-plugin/emerald-member-context-1.0.0.js` (+ unversioned alias + a `/flex-plugin` info
JSON), `Access-Control-Allow-Origin: *`.

**The bundle lives as a TS template literal** in `server/src/flex-plugin/bundle.ts` (exports
`FLEX_PLUGIN_UNIQUE_NAME`/`_FRIENDLY_NAME`/`_VERSION`/`_PATH`/`_BUNDLE`). Reason: `tsc` with
`rootDir: src` does NOT copy non-TS assets to `dist`, so reading a `.js` file off disk at runtime
would break the Railway build. **Constraint: the bundle body must contain NO backticks and NO
`${`** — all strings are single-quoted and concatenated.

**Plugin behaviour:** `flex.CRMContainer.Content.replace(<MemberContextPanel/>)` (the big empty
panel beside the call) + `flex.TaskInfoPanel.Content.add(<MemberSummary/>, {sortOrder:-1})`. Both
wrapped in `Flex.withTaskContext`. Reads everything off `task.attributes` (handles the string case
too) — the `emerald` object `buildTaskAttributes()` already sends. Renders: name/phone/studio,
membership tier+status, hold start/end/length, card on file + failed charge, classes booked, class
history (strikethrough for cancelled), favourite shake, last rating, escalation reason + ai_summary,
`recent_transcript`, Memory profile id. Graceful empty states for no-task and non-Emerald tasks.

**Verification harness (keep this — `npm run verify:plugin` in /server):**
`verify-plugin.ts` (tsx) writes the bundle to `/tmp/emerald-flex-plugin.js` → `node --check` for
syntax → `verify-plugin-render.cjs` stubs `window.React.createElement` + `window.Twilio.Flex`
(`withTaskContext` = identity, `Plugins.init` captures the class, `CRMContainer.Content.replace`
and `TaskInfoPanel.Content.add` capture elements), runs the bundle in `vm.runInNewContext`,
instantiates the plugin, calls `init`, then depth-first invokes every function component with a
realistic task and asserts expected strings appear. Proves the render path end-to-end without Flex.

**Registered on the account (all via createOrModifyTwilioResource):**
- Plugin `FP3979663140a9b336a6b5d7c2aeec4860` (`emerald-member-context`)
- Version `FV0329c3e00dc88670a432133192c3c80e` (1.0.0, Private=false, Railway URL)
- Configuration `FJa742dc2fe4a5f8174fba54c35e0d88d5`
- Release `FKb90d123dc78728ba9d3d10085f7d4468`
**Two API gotchas:** (1) `FriendlyName` rejects non-ASCII — an em dash gave error 70001
"friendlyName encoding not compatible". (2) `Plugins` on Configurations is a REPEATED param of
single JSON OBJECTS — passing a JSON *array* gives error 45008 "Unable to process JSON". Pass
`Plugins: '{"plugin_version":"FV..."}'`.

**Health reporting:** `checkPluginRelease()` in `journey/flex.ts` finds the newest Release, reads
`flexApi.v1.pluginConfigurations(sid).plugins.list()` (the accessor is `.plugins`, NOT
`.configuredPlugins` — tsc caught that) and matches `uniqueName`. Adds `pluginReleased`/
`pluginVersion`/`pluginUrl` to `FlexHealth`; `DeskStage` renders a new `PluginStatus` strip.

**Other files touched:** `tsconfig.json` root `exclude` now includes `"flex-plugin"` (otherwise the
Next build typechecks the plugin's `.tsx` and fails on missing `@twilio/flex-ui` types).
`/flex-plugin/` is a conventional plugin project (package.json, tsconfig, src/index.ts,
EmeraldMemberContextPlugin.tsx, context.ts, theme.ts, components/{primitives,MemberContextPanel,
MemberSummary}.tsx, README.md) — deliberately NOT npm-installed; it is the "rebuild it properly"
path and must be kept in step with `bundle.ts` (bump `FLEX_PLUGIN_VERSION`, since the version is in
the URL and that is what busts Flex's cache).

## Session 15 — REAL Flex handoff, by-name greeting, 30/60/90 holds, Act 4 pacing

**Flex now exists on the user's account** (`AC6b1d68e06745b643d5e145e352eeb464`) — earlier sessions
found 404 on `flex-api.twilio.com/v1/Configuration`; it now returns 200. Live values:
- `flex_instance_sid` GOf9ec28dae156442da2407965be5e8dfb
- `taskrouter_workspace_sid` **WSb8be57f4e743fbf205d51939be87dc07**
- `taskrouter_target_workflow_sid` **WW2bc53697297fa67502f6500071428e43** ("Assign to Anyone",
  `assignment_callback_url: null` — that's normal for Flex, the Flex UI handles reservations
  client-side via the TaskRouter JS SDK and conferences the call itself)
- `taskrouter_target_taskqueue_sid` **WQ36a826ac47c703e53a11eaef8555e203**
- `chat_service_instance_sid` IS5c58be2a46b74abeaca588cf22b03c3e
- **ZERO workers in the workspace** — the user must log into flex.twilio.com once (that creates the
  worker) and go Available before Act 4 will land.

New env vars: `FLEX_WORKSPACE_SID`, `FLEX_WORKFLOW_SID`, `FLEX_TASK_QUEUE_SID`,
`NEXT_PUBLIC_FLEX_URL` (= https://flex.twilio.com/agent-desktop).

**Handoff mechanism chosen (and why):** REST live-call redirect, NOT TAC's Studio handoff tool and
NOT ConversationRelay's `<Connect action>` + WS `end` message. Reasons: TAC's built-in handoff needs
`TWILIO_STUDIO_HANDOFF_FLOW_SID` and a Studio flow (extra moving part the user doesn't have), and
the `action`-URL route means giving up control of the twiml route. Instead
`server/src/journey/flex.ts` does `client.calls(callSid).update({ twiml })` where the TwiML is
`<Say>Connecting you…</Say><Enqueue workflowSid="WW…"><Task priority="10" timeout="900">{attrs}</Task></Enqueue>`.
The `<Say>` lives INSIDE the redirect TwiML because redirecting tears down ConversationRelay before
the LLM's final sentence could ever play. Verified via Twilio docs that `<Enqueue workflowSid>` +
`<Task>` is exactly what Studio's "Send to Flex" widget emits, so Flex UI accepts it.
twilio-node signature confirmed from `VoiceResponse.d.ts`:
`enqueue(attributes?: EnqueueAttributes, name?: string)` (workflowSid IS an EnqueueAttribute) and
`Enqueue.task(body: string)` / `task(attributes: TaskAttributes, body: string)`.

**Getting the callSid:** TAC exposes `voiceChannel.on("setup", cb)` → `{callSid, from, to,
customParameters}` (event name string is literally `"setup"`, confirmed in the compiled bundle at
`voiceCallbacks.onSetup`). `ConversationSession` does NOT carry callSid. Wired in `tac-server.ts` →
`recordCallSid(from, callSid)` in `journey/voice.ts`, stored as `state.callSid`. Fallback in
`flex.ts`: `calls.list({status:'in-progress', to: studioPhone})` matched on `from`.

**Personalised greeting (the "retrieve first name BEFORE greeting" ask):** TACServer spreads
`this.config.conversationRelayConfig` at REQUEST time, but rather than mutate a shared object via a
fastify hook (fragile), we **moved TAC's own twiml route aside** with
`webhookPaths: { twiml: "/tac-twiml" }` and registered our OWN `POST /twiml` in `tac-server.ts`. It
reads `From`, calls `buildGreeting(from)` (new export in `journey/voice.ts` — live journey state
first, else `lookupProfileIdByPhone` + `fetchProfileSnapshot` → `Contact.firstName` trait), then
calls `voiceChannel.handleIncomingCall({ actionUrl, conversationRelayConfig: { url: wss://host/ws,
welcomeGreeting, welcomeGreetingInterruptible: 'speech' } })`. `handleIncomingCall` injects
`conversationConfiguration` itself when the orchestrator is enabled. The phone number's VoiceUrl
still points at `/twiml` so nothing had to change in Twilio. Greeting text is stored on
`state.greeting` and the voice prompts now reference it via `styleFor(state)` instead of a
hardcoded VOICE_STYLE sentence.

**30/60/90 holds:** `HOLD_OPTIONS = [30,60,90]` exported from `script.ts`. `holdPrompt` now
instructs the agent to offer the three lengths out loud, then confirm the chosen end date;
`place_membership_hold.days` is `z.union([z.literal(30),z.literal(60),z.literal(90)])` with a
runtime guard. `state.membership.holdDays` added.

**Act 4 pacing fix:** the flow "jumped straight to Flex" because `flagExpiredPayment()` called
`completeBeat(state,'voice-callback')`, which advanced beatId to `flex` (stage `desk`) mid-call.
Removed that; `escalateToDesk()` now owns the advance (completes `voice-callback` then `flex`).
`callbackPrompt` restructured into 7 numbered steps: react warmly FIRST ("that's great news,
welcome back") on its own turn → THEN `check_payment_method` → expired-card news → ask permission →
`transfer_to_front_desk` → say nothing after. Also `JourneyWorkspace` now renders `LiveCallStage`
whenever `callStatus === 'in-call'` even on a `call-prompt` beat, so the callback call shows a live
transcript instead of the "call us" card.

**Transfer bookkeeping:** `state.transferring` flag — `handleJourneyVoiceTurn` returns `undefined`
(speaks nothing) once set, and `handleJourneyCallEnded` early-returns so a Flex transfer isn't
mistaken for a hangup (she's still on the phone, just with a human).

**Removed copy** (explicit user ask): "Nothing is sent in this beat. Set the scene, then start the
journey — everything from here is live." on the `setup` beat → replaced with a mechanic line listing
the real products in play.

**New/changed files**
- NEW `server/src/journey/flex.ts` — `resolveFlexSetup()` (env first, falls back to reading
  `flexApi.v1.configuration().fetch()`, cached), `checkFlexHealth()` (15s cache; counts workers +
  available workers, resolves workflow/queue friendly names, returns `ok/problem/hint`),
  `buildTaskAttributes()` (Flex-shaped: type/direction/name/customerName/from/called/customers plus
  an `emerald` context object, `ai_summary`, `recent_transcript`, `conversations.*` for Insights),
  `transferCallToFlex()`, `fetchFlexTask()` (finds the task via
  `tasks.list({ evaluateTaskAttributes: 'call_sid == "CA…"' })` — `<Enqueue>` auto-adds `call_sid`
  to attributes — then reads reservations for `workerName`), `pollForTask()` (dynamic
  `import("./bus.js")` to avoid a circular import).
- `journey/state.ts` — added `FlexHandoff` interface, `state.flex`, `callSid`, `greeting`,
  `transferring`, `membership.holdDays`.
- `journey/engine.ts` — imports `transferCallToFlex`; `escalateToDesk` does the real transfer and
  records success/failure on `state.flex`.
- `journey/routes.ts` — `flex` added to `/journey/config`; new `GET /journey/flex` and
  `POST /journey/flex-check`. (`/journey/desk/claim` left in place but no longer used by the UI.)
- `src/components/journey/DeskStage.tsx` — REWRITTEN. No fake agent desktop / no "Accept the call"
  button. Now: a readiness banner (green "N agents available" / amber "nobody is online" with an
  Open Flex button + Check again), a live TaskRouter task card (task SID, assignment status, queue,
  accepted-by, workflow), the exact context payload handed over, "Open Flex to answer →", and the
  last 60 seconds of transcript. `stage` is derived from `handoff.status`/`worker`.
- `JourneyWorkspace.tsx` — new `FlexChip` in the header; `handleClaim` replaced by
  `handleFlexRecheck`; DeskStage gets `flex`/`onRecheck`.
- `use-journey.ts` — `flex` state, `refreshFlex(force)`, and a 5s poll while beatId is
  `voice-callback` or `flex`.
- `src/lib/journey/types.ts` — `FlexHealth`, `FlexHandoff`, `config.flex`, state additions.

**Tooling notes**: `getFileContents` still can't read node_modules — used throwaway
`server/scan-tac.cjs` + `node` to read `twilio-agent-connect/dist/index.d.ts` and `index.js`
(`node -e` still breaks on quotes in this webcontainer, always write a .cjs file).
`createOrModifyTwilioResource` GET works fine against `flex-api` and `taskrouter` hosts.


Root cause: `ShowcaseClient.tsx`'s IntersectionObserver used a single fixed `threshold: 0.5` to
decide the active nav dot. The Maturity section (title block + horizontal tile row + large detail
panel with tech chips/use-cases/two value columns) is much taller than one viewport, so its
intersection ratio could never reach 0.5 — the callback never fired for it, so its dot never
lit up as active even though clicking it still scrolled correctly (looked "unselectable").
Fixed by tracking every section's intersection ratio in a `Map` across callback invocations and
always setting `activeId` to whichever section currently has the HIGHEST ratio (with a wide
threshold array `[0, 0.1, ... 1]` so ratio changes are reported frequently), instead of requiring
any single section to cross 0.5 on its own. This is robust regardless of a section's height.

## Session 8 — Better RCS photos + simulated "BARRY'S" shirt branding
User said the RCS card photos were "terrible" and described what's needed: gym trainers wearing a
plain black t-shirt with "BARRY'S" in white text, white/plain background, smiling. No stock photo
service will have actual Barry's-branded merchandise, so instead of trying to find a closer stock
match, added a real fix: `searchStockImages` for plain black-tee-on-white-background portraits
(`23285895` woman for Charlie, `37537775` man for Jordan, `13026082` man for Jess — all confirmed
black shirt + white/plain studio background + smiling in their alt text), THEN overlaid a white,
bold, letter-spaced "BARRY'S" wordmark (with a dark text-shadow for legibility) absolutely
positioned near the bottom of each photo in `PhoneFrame.tsx`'s `RcsView`, simulating the shirt
logo directly on top of the real photo. Also increased the image crop height (h-28→h-32) and used
`object-[center_75%]` to bias the crop toward showing more shoulder/chest area so the "logo" has
plausible room to sit on the shirt.

## Session 9 — Remove "Always First" label, fix broken RCS photos (faces cut off + bad image)
- **`MaturitySection.tsx`**: removed the "🔒 Always first" text label from the locked
  Foundational-SMS tile's footer per user request — kept just the 🔒 icon, tile is still
  functionally locked (non-draggable, can't be reordered), just no longer explicitly labeled.
- **RCS photo bug root-caused**: the previous session's `object-[center_75%]` CSS crop shifted the
  visible window DOWN, which cropped out the top of the image (the face) — that's why "none of
  them show the peoples faces." Fixed by switching to `object-top` so the crop keeps the top
  (face) of the portrait in frame instead.
- Also swapped out the `Jess F.` photo (was `13026082`, ambiguous/arms-crossed on a gray
  background — likely the one that rendered with some kind of odd overlay/warning per user's
  report) for `37537773` (same photographer/series as Jordan's confirmed-good `37537775`: "Casual
  portrait of a smiling man in a black t-shirt... relaxed pose"). Kept Charlie (`23285895`) and
  Jordan (`37537775`) since their alt text explicitly confirms black shirt + white background +
  smiling. Also removed the manual `h=300&w=400` Pexels crop query params (was forcing an
  aggressive server-side landscape crop before our own CSS crop even ran) — now uses the larger
  `h=650&w=940` size returned directly by `searchStockImages` and lets CSS `object-cover` +
  `object-top` do the cropping instead.
- Note: I cannot visually inspect the actual pixel content of any stock photo URL before using it
  (no image-viewing capability) — only reason from the text description/alt text Pexels provides.
  If a photo still looks wrong, that's the limitation; swapping to another described-as-similar
  photo is the best available fix.

## Session 10 — Real uploaded assets, video card, Maturity click-to-reveal + connector line, UX polish
- **Real RCS instructor photos**: replaced Pexels stock photos with the user's actual uploaded
  Vercel Blob URLs (Jordan S., Jess F., Charlie C.) in `capabilities.ts`. RCS card photo treatment
  changed from a full-bleed stretched banner to a small centered circular avatar (in `PhoneFrame.tsx`
  `RcsView`) — fixes "blown up/pixelated" look from forcing a low-res photo to fill the full card width.
- **Embedded Capabilities video card**: the "Rich Class Invitations" card's `type` can now be
  `'video'` with either `videoUrl` (native `<video autoPlay muted loop playsInline>`, used for a
  directly-hosted file) or `videoEmbedUrl` (iframe, e.g. YouTube). Learned the hard way: (1) a
  raw.githubusercontent.com link to a file in a PRIVATE repo returns 404 for anyone/anything
  unauthenticated — confirmed via a live fetch — so that approach only works for PUBLIC repos;
  (2) Loom's iframe embed shows an unavoidable title+channel-avatar overlay on hover/pause with no
  official param to disable it — worked around by making the iframe `pointer-events-none` plus a
  transparent shield div on top, so it's fully non-interactive and the overlay can never trigger.
  Final working source for this session: YouTube "Unlisted" embed with
  `autoplay=1&mute=1&loop=1&playlist=<id>&controls=0` (the `playlist=<same id>` trick is required
  for YouTube's iframe loop to actually work). Video card frame uses the exact same
  `w-[240px] h-[490px] rounded-[2.25rem] ...` dimensions as `PhoneFrame` so it lines up with
  neighboring cards in the row (was previously a mismatched 16:9 box).
- **Root-caused real horizontal page bleed** (not just a visual nitpick): `HorizontalScrollRow`'s
  `-mx-6 md:-mx-10` trick only works when the row is nested inside a padded parent (giving back
  that padding as intentional edge-bleed). In this app the row is a DIRECT full-width child of each
  `<section>` (no parent padding to offset), so the negative margin was pushing real content past
  the viewport edge — fixed by removing the negative margin entirely (row is just `w-full
  overflow-hidden` now) instead of only band-aiding with `overflow-x-hidden` on the outer scroll
  container (kept that too, as a safety net, in `ShowcaseClient.tsx`).
- **Maturity Framework interaction overhaul** (`MaturitySection.tsx`):
  - No level is auto-selected on load anymore; details only appear after a click (click same tile
    again, or the ✕ on the panel, to close). Idle tiles gently pulse (`.idle-glow`) before anything
    is selected, as a discoverability hint.
    Selected tile + the details panel both share a matching pulsing `.perimeter-glow` border.
  - A connector between the selected tile and the details panel is drawn as an SVG **path** (not a
    plain div/line) — computed via `buildElbowPath()`: straight down from the tile, a smoothly
    rounded 90° bend, then straight down again into the exact horizontal center of the details
    panel's TOP BORDER (not into the box interior — user was specific about this). No arrowhead
    (removed per feedback), no dashed/marching animation (also removed as "overkill") — just a
    steady line with a slow, soft `connector-glow-pulse` (mint↔neptune, low intensity).
  - Auto-scrolls (`scrollIntoView({behavior:'smooth', block:'start'})`) to the details panel on
    selection so the user doesn't have to manually scroll down to read it.
  - Added: Prev/Next level buttons at the bottom of the details panel (`goToLevel`, distinct from
    `selectLevel`'s toggle-close behavior), a "X of N" + clickable progress-dot row in the panel
    header, and deep-linkable levels via URL hash (`#maturity-<id>`, read on mount + written via
    `history.replaceState` — explicitly declined: keyboard arrow-key navigation).
  - Lint gotcha: `react-hooks/set-state-in-effect` flagged the mount-only hash-read effect even
    though it's a legitimate one-time external-state sync — fixed with a targeted
    `// eslint-disable-next-line react-hooks/set-state-in-effect` rather than restructuring.
- **New Live Demo: browser voice calling via the Twilio Voice Client SDK** — mapped to Level 2's
  EXISTING "Single-Number Voice/SMS Unification" use case (expanded its description) rather than
  adding a new use case, per explicit user direction. Level 2 `techStack` split
  `'Programmable Voice / SIP'` into three separate pills: `'Client SDK'`, `'Programmable Voice'`,
  `'SIP'`.
  - `@twilio/voice-sdk` added to `package.json`.
  - `src/app/api/token/route.ts` (new) — issues a short-lived Voice `AccessToken` with
    `outgoingApplicationSid: TWILIO_TWIML_APP_SID`, `incomingAllow: false` (outbound-only demo).
  - `src/hooks/use-webrtc.ts` (new) — `useTwilioDevice()` hook; `device.connect()` is called with
    NO params (not `{To: ...}`) since the TwiML App's Voice URL itself fully determines what
    happens next.
  - `src/components/showcase/BrowserCallDemo.tsx` (new) — Call/Hang Up widget, added to
    `LiveDemosSection.tsx` grid to the LEFT of `AiConcierge` (grid is now
    `md:grid-cols-2 lg:grid-cols-3`, order: BrowserCallDemo, AiConcierge, VerifyDemo).
  - **Key architectural link**: rather than building a brand-new voice backend, the new TwiML
    App's `VoiceUrl` points at the SAME `/twiml` endpoint already used by the existing `/server`
    TAC voice channel (confirmed by inspecting `twilio-agent-connect`'s compiled bundle —
    `DEFAULT_CONFIG.webhookPaths.twiml === '/twiml'`) — so a browser-originated WebRTC call rings
    into the exact same `ConversationRelay`-powered AI Concierge as real phone calls. TwiML App SID
    `APa87e84e49c06cddbeb984f71f10012d0` created via the Twilio API and persisted via
    `updateTwilioMetadata`; `TWILIO_TWIML_APP_SID` env var registered.
- User plans to map more demos to other maturity levels in future sessions — this session
  intentionally stayed scoped to just Level 2/the Client SDK demo per their explicit request.

## Session 11 — Browser demo rebuilt as a real softphone (dial pad, real PSTN dialing, recents)
User feedback: the single "Call" button that always rang the AI Concierge didn't feel like a real
phone. Rebuilt `BrowserCallDemo.tsx` into an actual softphone UI: numeric keypad (0–9,*,#) with a
live-formatted number display, backspace, Call/Hang Up, DTMF tones sent mid-call via
`call.sendDigits()`, and a "Recents" list persisted in `localStorage` (pre-seeded, per explicit
user instruction, with exactly 2 real contacts: Michael Ruby `+13038838578` and Casey Runnells
`+12134222382` — user explicitly rejected an "AI Concierge" self-dial contact as illogical: "the
staff wouldn't be calling their own AI agent, that's insane").

**Architecture change — real outbound PSTN dialing, not routed through the AI agent**:
- `useTwilioDevice` (`src/hooks/use-webrtc.ts`) now takes a `to` string:
  `device.connect({ params: { To: to } })`, and exposes `sendDigit(d)` for in-call DTMF.
- Added a NEW route directly in `/server` (`server/src/tac-server.ts`,
  `server.fastify.post("/outbound-dial", ...)`) rather than a Next.js API route — reasoning:
  Vercel deployment protection blocks unauthenticated inbound webhooks (would need the bypass
  secret hacked into the Twilio-facing URL), whereas the Railway-hosted `/server` has no such
  protection, so it's the clean place for a Twilio-called webhook. Confirmed `@fastify/formbody`
  is already registered globally by the `twilio-agent-connect` package (inspected the compiled
  bundle), so `request.body` is already parsed for this new route with no extra setup.
  Route logic: reads `To` from the POST body, returns `<Dial callerId={TWILIO_PHONE_NUMBER}>{To}</Dial>`
  TwiML — a genuine outbound call to whatever real number was dialed. `twilio` package (already a
  server dependency) used for `twilio.twiml.VoiceResponse()`.
- The EXISTING TwiML App (`APa87e84e49c06cddbeb984f71f10012d0`, created last session for the
  original "always call the AI Concierge" version) had its `VoiceUrl` updated via the Twilio API
  to point at `.../outbound-dial` instead of `.../twiml` — same TwiML App reused, just repointed.
- Flagged to the user (not blocking, they acknowledged): this demo is public and dials REAL phone
  numbers with real Twilio account charges — no safeguard/allowlist was added since they didn't
  ask for one, but worth revisiting if abuse becomes a concern.
- Same `react-hooks/set-state-in-effect` lint pattern as before (reading `localStorage` on mount) —
  fixed the same way, with a targeted eslint-disable rather than restructuring into a lazy
  `useState` initializer (which would require a SSR/`window` guard and risks a hydration mismatch
  since the seed vs. stored recents could differ).

## Session 12 — Reframe as staff BMS tool + live Conversational Intelligence panel
User correction: the "member taps Call the Studio" framing was wrong ("that's dumb") — this is a
STAFF tool embedded in Mariana Tek's BMS/Biz App for calling leads, not a member-facing feature.
Updated Level 2's "Single-Number Voice/SMS Unification" use case description accordingly
(`maturity.ts`). Also removed the Recents list and the phone icon entirely per explicit request —
the localStorage-persisted recents concept from Session 11 is now gone, replaced by a simpler
dial pad shown consistently in both idle and in-call states.

**New: `ConversationIntelligencePanel.tsx`** — sits to the RIGHT of the phone (not inside the same
card — user explicitly wanted a separate adjacent tile after initially asking to reuse the phone's
own space). Shows a simulated real-time Conversational Intelligence view during a call: a chip row
of 5 Language Operators (researched via Twilio MCP — `twilio__search`/`docs`, since CINTEL/Language
Operators are flagged as "research with MCP" topics — picked deliberately for an outbound
lead-calling scenario: **Sentiment Analysis**, **Summarization**, **Outbound Call Disposition**,
**Voicemail Detection** (all Twilio pre-built), plus **Lead Qualification Score** as an illustrative
**custom** operator, tagged "· custom" in the chip), a live transcript that streams in on a
scripted timeline once `callStatus === 'in-call'`, a sentiment badge that flips neutral→positive,
a progressively-updating "Live summary" block, and on hangup a finalized "Call disposition" +
"✓ Synced to Mariana Tek BMS" line. This is explicitly labeled as simulated (small caption at the
bottom: "Simulated for this demo — shows what Twilio Conversational Intelligence surfaces in real
time") rather than a real GenAI/transcription pipeline — wiring actual live transcription into this
WebRTC demo call would require a real-time media-stream → STT → Intelligence Service pipeline,
which is out of scope for an illustrative UI pane; this follows the same "clearly-labeled mockup"
precedent already established for Branded Calling/RCS earlier in the app.

**Architecture**: `BrowserCallDemo.tsx` no longer calls `useTwilioDevice()` itself — it's now a
controlled component taking `isReady`/`callStatus`/`onCall`/`onHangup`/`onSendDigit` as props. A
new `PhoneWorkspace.tsx` (`'use client'`) owns the single `useTwilioDevice()` instance and renders
`<BrowserCallDemo>` + `<ConversationIntelligencePanel>` as **Fragment siblings** (not wrapped in an
extra div) specifically so both become direct grid children of `LiveDemosSection`'s grid container
— this is what makes the CINTEL panel land immediately adjacent to the phone at every breakpoint
without needing a nested sub-grid. `LiveDemosSection`'s grid widened from `lg:grid-cols-3` to
`lg:grid-cols-4` (order: phone, CINTEL, AI Concierge, Verify) — on `md` it wraps 2x2 with phone+CINTEL
as row 1.
- Same `react-hooks/set-state-in-effect` gotcha again for the effect that resets transcript/sentiment/
  summary state when a new call starts — only the FIRST `setState` call in the effect body needed
  the eslint-disable comment; adding it to every subsequent call in the same effect triggered
  "unused eslint-disable directive" warnings (the rule only flags the first occurrence per effect).


## Session: flip cards + accelerator wording
- Removed the "See it in the guided journey" CTA from both Adoption Arch pop-outs in MaturitySection.tsx (stage detail panel and Flex SDK card).
- Wording: "shortcut" -> "accelerator" in MaturitySection intro copy, the Flex card badge (THE ACCELERATOR), and flexShortcut.description in src/lib/data/maturity.ts. CSS class shortcut-glow and the FlexShortcut type name intentionally left unchanged.
- New src/components/showcase/MetricFlipCard.tsx (client): the 4 industryMetrics cards in HeroSection now start showing only the headline figure (multi-stat card stacks +12%/+18%/+17% vertically) and flip on click to the previous detail face; state persists per card, citation link stops propagation.
- globals.css: added .flip-card/.flip-inner/.is-flipped/.flip-face/.flip-face-back 3D flip utilities. Front face uses existing mint-glow-ring for the click affordance; back face is in normal flow (sets height) with the front absolutely overlaid, grid items-stretch keeps row heights equal.

## Session: How Does It Work rebuilt (5 colored layers + return path)
- All three WIP/placeholder notices removed from HowItWorksSection.tsx (badge, inline sentence, footer disclaimer).
- src/lib/data/architecture.ts rewritten: ArchStage now has `layer` (eyebrow "Layer 1"..) + `accent` hex, `description` optional. Five stages: Member Touchpoints (mint, merges old consumer+brand boxes, chips: phone line/SMS/app/web booking/kiosk/email/RCS), BMS Platforms (neptune, copy+chips unchanged incl. active Mariana Tek chip), Centralized AI Harness · Xplor (neptune, consolidation copy, no plumbing language), Twilio Agent Connect (twilio red #f22f46, model-agnostic/self-hosted/swappable), Twilio Platform (twilio red, no description, 9 chips incl. Conversation Orchestrator/Memory/Intelligence/Relay, Branded Calling, 10DLC/A2P, Segment).
- HowItWorksSection.tsx: cards/connectors/chip rails tinted per stage accent; connector between cards takes the NEXT stage's accent. Added `ReturnPath` — decorative CSS bracket (border-y + border-r, rounded-r) on the right of the stack from bottom layer up to Layer 1 with a ◀ arrowhead and vertical label; positioned via left-1/2 ml-[14rem] right-0 (works because the cards are max-w-md centered), md+ only, with a plain-text fallback line on mobile.

## Session: Executive Vision rework + Next Steps + copy tweaks
- src/lib/data/executive-vision.ts: ExecutiveVisionCard shape changed from {headline, subhead} to {headline, label, body, citations?, note?}. Headline copy now "You already ran this playbook with embedded payments." / "Embedded communications is the second act." Cards: "2–5× / Revenue per customer" (a16z link), "2–4× increase / in valuation" (733Park + Meritech links, joined by ·), "Zero / Orchestration Xplor builds" with plain-text note "Xplor + Twilio" (no link). Card 1 body says "Embedded payments already proved the model" (was "Xplor Pay").
- ExecutiveVisionSection.tsx renders figure (text-3xl/4xl mint) + bold label + body, citations pinned to card bottom via mt-auto with a top rule.
- ClosingSection.tsx: removed both CTA buttons ("Revisit the guided journey", "Back to the top"); added a 3-card nextSteps grid (Technical Deep Dives / POC Scoping Session / Onsite Hackathon), container widened to max-w-5xl with headline+intro kept at max-w-3xl mx-auto.
- StorySection.tsx headline now "When it comes to build vs. buy, the market has already decided: for AI communications, building in-house is the losing play."
- How It Works: layer eyebrows removed (ArchStage.layer field deleted), harness renamed "Xplor Centralized AI Harness", Segment chip removed, return-path label text removed (arrowhead only). ShowcaseClient nav label "How It Works" (dropped "(WIP)").
- README "What's inside" refreshed for Industry Perspective flip cards, Executive Vision, The Opportunity headline, How Does It Work layers, and Next Steps.

## Session 67 — Act 4 agent went down a "compose a message for the front desk" detour
Symptom: on the callback call, when Maya asked to come off account hold, the agent started asking
her to come up with / word a message for the front desk instead of surfacing the expired card and
asking to transfer. This had worked before.

**Root cause:** `transfer_to_front_desk`'s `reason` and `summary` were REQUIRED string params with
verbose descriptions. gpt-4.1-mini, when it can't confidently fill a required descriptive param,
interrogates the user for it — so it turned "write a 2–3 sentence summary" into "what would you
like me to tell the desk?" Nothing in `callbackPrompt` forbade message-taking either.

**Fixes, all in `server/src/journey/voice.ts`:**
- `transfer_to_front_desk` params are now `.optional()` with server-side fallbacks built from
  `state` (`fallbackReason`, `fallbackSummary` naming tier/card last4/expiry/failed charge), and
  both descriptions say "written by you, never asked of the member". The model can now call the
  tool with zero args and the Flex task still gets good context.
- New `REACTIVATION_REQUEST` regex + `reactivationDirective(state, message)`. `callbackPrompt` now
  takes the current utterance (`callbackPrompt(state, message)`) and appends a hard THIS-TURN block
  when she asks to come back: call `check_payment_method` → warm line → expired card → ask to bring
  in the West 7th desk, all in ONE reply, and an explicit ban on offering a message/note/callback
  or asking what she'd like the desk to know. If the card was already checked this call, the
  directive instead says don't re-check, just ask permission or transfer.
- Two new hard rules at the top of `callbackPrompt`'s hard-rules list: (1) there is NO message to
  take and NO callback to arrange — the desk joins THIS call live; (2) never ask her to help
  summarise/describe her own situation.
- `check_payment_method`'s return string gained "Do not offer to take a message, note or callback
  instead."
- Requires Push & Redeploy (Railway).

## Session 68 — THE REAL ROOT CAUSE: the generic concierge was hijacking journey turns
Symptom escalated: on reactivation the agent asked the caller for her EMAIL ADDRESS and PHONE
NUMBER. Nothing in `journey/voice.ts` ever asks for those — that is `generateAgentResponse()` from
`server/src/agent.ts`, the generic TAC concierge.

**ROOT CAUSE (in `tac-server.ts`'s `onMessageReady`):**
```ts
const reply = await handleJourneyVoiceTurn(journey, message);
if (reply) return reply;      // <-- falls THROUGH when reply is undefined
...
return await generateAgentResponse(conversationId);
```
`handleJourneyVoiceTurn` returns `undefined` in FOUR normal situations: room noise, `state.hangingUp`,
`state.transferring`, and — the killer — **when the model spends its whole turn on a tool call and
returns empty text**. In every one of those the code fell straight through to the generic concierge,
which had no journey context and started onboarding her from scratch. Session 67's directive (forcing
`check_payment_method` + prose in ONE reply) made empty-text turns MORE likely, which is why the
detour got worse, not better, after that fix. This bug has been latent since Session 13.

**Verified from the TAC types** (`node_modules/twilio-agent-connect/dist/index.d.ts`):
`MessageReadyCallback` returns `Promise<string | null | void>` and the doc comment says "Return a
string to auto-send, or null/void for manual handling." So **`null` is a valid "say nothing"** —
that's the correct way to own the turn without speaking.

**Fixes:**
- `tac-server.ts`: `return reply ?? null;` — once a journey state exists for a voice call, the
  journey owns that turn unconditionally. The generic concierge can never take over mid-call again.
- `voice.ts`: `buildVoiceTools(state, turn)` now takes a per-turn `{ paymentChecked: boolean }`
  tracker set inside `check_payment_method.execute`. After `generateText`, if the reply is empty AND
  the card was just checked AND we're not transferring/hanging up, the reply is replaced with a new
  deterministic `expiredCardLine(state)` (welcome back + Visa ••••last4 expired expiry + can't take
  card details + ask to bring in the West 7th desk). So that turn can never be silent OR hijacked.
- `stopWhen: stepCountIs(4)` → `stepCountIs(6)`, since the forced turn is tool + prose and 4 steps
  was tight.
- Requires Push & Redeploy (Railway).

**Lesson for any future TAC callback work:** never use `if (reply) return reply` as a routing guard.
An empty/undefined reply from a scoped handler is a legitimate outcome, not "not handled".

## Session 69 — Flex showed a frozen score / no NBA: we were patching the WRONG TASK
User reported: app UI shows live retention risk climbing and the threshold event fired, but Flex
showed no risk score, no call reason, no NBA.

**Verified live, not guessed.** Plugin side is fine: release `FKcba294cb43a646760c4146f1fa4f437c` →
config `FJ51d6ed6bbd119ef5a79ca37156d6a26c` → plugin 1.1.1 at
`https://bpwilke-xplor-twilio-showcase-final-production.up.railway.app/flex-plugin/emerald-member-context-1.1.1.js`,
and `GET /flex-plugin` on Railway returns 200 (28125 bytes). The bundle does render IntelBlock + NBA.

Then read the actual TaskRouter tasks (`GET /v1/Workspaces/WSb8be.../Tasks?Ordering=DateCreated:desc`):
- Task **WTa8e8156172ee4acc99f88a3a63ea10dc**, created 20:26:29 (the live one the agent handled):
  `intelligence.retention_risk_score: 38`, `next_best_action: null`, `updated_at 20:26:23` — i.e.
  frozen at the enqueue-time snapshot.
- Task **WT5681465ed0312fda9e522821ccc2ad46**, created **18:38:40** (a PREVIOUS run, already
  completed): `intelligence.retention_risk_score: 92`, `threshold_crossed: true`,
  a full `next_best_action`, `updated_at 20:27:49` — updated DURING the 20:26 call.

**ROOT CAUSE (two compounding bugs):**
1. `transferCallToFlex` did `state.flex = { ...(state.flex ?? {}), ... }` and never cleared
   `taskSid`/`worker`/`queue`. On a second run in the same JourneyState, the PREVIOUS run's taskSid
   survived the new transfer, so from the very first cintel result of the new call every patch went
   to the old, completed task.
2. `fetchFlexTask`'s last-resort lookup was
   `tasks.list({ evaluateTaskAttributes: 'escalated_by == "Emerald Fitness voice AI"', limit: 5 })`
   with **no ordering** (TaskRouter defaults to ascending DateCreated) and **no status filter**, then
   took `recent[0]` — the OLDEST matching task, including completed ones from previous runs. And
   because `fetchFlexTask` short-circuits on an existing `state.flex.taskSid`, once wrong it stayed
   wrong forever.

**Fixes:**
- `state.ts` `FlexHandoff` gained `callSid?: string` (mirrored in `src/lib/journey/types.ts`).
- `flex.ts` `transferCallToFlex`: records `callSid` and explicitly resets
  `taskSid/worker/queue` to undefined, `status: "pending"`.
- `flex.ts` `fetchFlexTask`: new `belongsToThisCall(task)` — true if the task's `call_sid`/
  `journey_call_sid` matches this call, OR (backstop, since Enqueue can drop filterable attributes)
  the task was created within 15s before `transferredAt`. Applied to (a) validating a stored taskSid
  — a stale one is now DISCARDED and re-resolved, (b) the call_sid queries, (c) the last resort,
  which now also uses `ordering: "DateCreated:desc"`, `limit: 10`, and requires
  `assignmentStatus ∈ {pending, reserved, assigned, wrapping}` (`LIVE_TASK_STATES`).
  Extracted `parseAttributes()`.
- `flex.ts` `pollForTask`: 8 attempts (was 4), re-pushes intelligence whenever the resolved taskSid
  CHANGES (was once ever), and only breaks when both a worker AND a taskSid exist.
- `intel.ts` `pushIntelToFlexTask`: bails if `state.flex.callSid !== state.callSid`, and after
  fetching the task compares the task's own `call_sid` to the expected one — on mismatch it clears
  `taskSid`, re-runs `fetchFlexTask`, and skips the write.
- `ordering` is a real `TaskListInstanceOptions` field (verified in
  `node_modules/twilio/lib/rest/taskrouter/v1/workspace/task.d.ts`); `assignmentStatus` filtering is
  done client-side to stay type-safe.
- Requires Push & Redeploy (Railway).

## Session 70 — Whole call answered with SILENCE (the flip side of Session 68)
Symptom: called in to reactivate, agent said nothing at all. Railway runtime logs showed
`[onMessageReady] ... "channel":"voice"` firing THREE times, no errors, no replies — so the journey
handler was deliberately returning undefined for every utterance, and Session 68's `return reply ?? null`
correctly refused to let the generic concierge cover for it.

**ROOT CAUSE:** per-call state was reset inside `handleJourneyVoiceTurn` behind
`if (state.callStatus !== "in-call")`. That marker only becomes `"ended"` via
`handleJourneyCallEnded`, which **early-returns without setting it when `state.transferring` is true**
(deliberately — she is still on the phone with a human) and never runs at all if the session drops
without a teardown event. So after any Flex handoff, the run is permanently `callStatus: "in-call"`
with `transferring: true` and possibly `hangingUp: true` — and the guards at the top of
`handleJourneyVoiceTurn` (`if (state.hangingUp) return undefined`, and `if (state.transferring) return undefined`
after generation) silence every utterance of every subsequent call, forever.
Before Session 68 this was masked: the generic concierge answered instead, which is where
"it asked me for my email and phone number" came from. Same underlying defect, two symptoms.

**Fixes (all `server/src/journey/`):**
- `state.ts`: new `activeCallSid?: string` on `JourneyState` — the call whose per-call flags are
  loaded. Deliberately NOT derived from `callStatus`.
- `voice.ts`: new `beginCall(state, callSid)` — no-ops if `activeCallSid === callSid`, otherwise
  resets `callStatus/callCount/transcript/transferring/hangingUp/paymentCheckedOnCall`, `resetIntel`,
  clears `callHistory`, and logs. Called from `recordCallSid` (relay setup frame, fires once per call)
  AND defensively at the top of `handleJourneyVoiceTurn` when `activeCallSid !== callSid`, using a
  `local-<ts>` synthetic SID if the setup frame never arrived.
- **Ordering matters**: the new-call detection now runs BEFORE the `hangingUp` guard. With the old
  order a stale flag silenced the very call that was meant to clear it.
- `handleJourneyVoiceTurn`'s old reset block is now only the beat-advance + `callStatus = "in-call"`.
- Last-resort anti-dead-air: if there is no reply text and we are not transferring/hanging up, speak
  "Sorry, could you say that once more for me?" rather than returning undefined. Combined with
  Session 68's `?? null`, a genuine utterance can now never be met with silence.
- Logging added (this cost two rounds of guessing): call start (`call N started (SID) — beat, membership`),
  every turn (`turn on call N (callback|hold) — "<utterance>"`), each quiet reason
  (goodbye already spoken / handed to Flex), and a `console.warn` when the model produced no words.
- `handleJourneyCallEnded`'s transferring early-return was left as-is on purpose — it is correct
  behaviour, it was only ever unsafe because the reset depended on it.
- Requires Push & Redeploy (Railway).

## Session 71 — NBA recommended PROCEDURE, and intel stopped arriving on the human leg
Task-targeting fix from Session 69 confirmed working: task `WT3d8e4eb5157ced3cd9efe4ab6decea0f`
(created 20:59:52, `call_sid CA6b7d48…`) had `intelligence.updated_at 21:00:11` — the RIGHT task was
being patched. Two remaining faults, both visible in that payload:

**Fault A — the NBA recommended process, not a save.**
`next_best_action.headline: "Warm transfer for payment"`, offer = bring her to the desk for a secure
terminal, `policy_source: "Coming off hold and failed payment handling"` — that is playbook §2, a
PROCESS rule. The old prompt only said "never recommend an action the agent is already carrying out";
the model read the §2 transfer rule as a legitimate next best action.
Fixed by rewriting the **Emerald Next Best Action** operator prompt (now **version 4** on
`intelligence_operator_01kz6x06xmecdra4mhhq77kvrq`): "You recommend GOODWILL, never PROCEDURE",
the ONLY permitted output is an approved save offer from §3 (class credit + 15-min coaching consult,
plus an optional fee waiver) or `recommend: false` — "there is no third option". Explicit ban list:
transferring/warm transferring/connecting, taking or updating a card, secure terminal, payment link,
re-running a charge, reactivating/releasing/placing a hold, calling back, noting the account.
"An expired card or a failed payment is PROCEDURE on its own." `policy_source` must name the approved
save offers section and must NEVER cite the hold or failed-payment rules. Also: coming off hold with
just a card update and no complaint is explicitly ROUTINE → recommend nothing.

**Fault B — retention score read 5/100 and then froze.**
Same payload: `retention_risk_score: 5`, band low, `drivers: []`, `quote: null`, `trend: steady` —
while `call_reason: "Thinking about cancelling"` with 99% confidence and evidence
"I'm thinking about canceling my membership". Two separate causes:
1. The risk operator under-scored explicit cancellation talk. **Emerald Retention Risk** prompt now
   has hard FLOORS that are permanent for the rest of the call: cancellation talk ≥ 75, no value /
   not worth it ≥ 60, injury ≥ 60 (≥ 80 with disengagement or failed payment), "never lower the score
   back down because a later part of the conversation went smoothly". Also: empty drivers/quote are
   only allowed in the low band — from 25 up it must name a driver and quote her.
2. `applyRuleExecution` required a literal `VOICE` entry in `executionDetails.channels` and returned
   false otherwise. After the Flex handoff, Real-Time Transcription results do not always carry that
   label, so they were silently discarded — the meter froze ~19s after the agent picked up. Now it
   only DROPS a result when the channels are all messaging (`MESSAGING_CHANNELS`: SMS/MMS/RCS/
   WHATSAPP/CHAT/MESSENGER/EMAIL/WEB) or when no call is live; an unlabelled result during a live
   call is accepted. `callLive` = `callStatus === "in-call" || "ringing"`, which stays true through
   the human stretch because `handleJourneyCallEnded` deliberately does not mark a transferred call
   ended.

**Logging added** (this is the third session lost to guesswork):
- `routes.ts` `/journey/cintel`: every delivery logs result count, operator display names,
  conversationId, and "NO LIVE RUN, ignored".
- `intel.ts`: applying vs ignoring with the channel list, every risk score + band + drivers, and
  whether a save offer was released or parked.

Operator changes are live on the account immediately (no redeploy needed); the code changes need
Push & Redeploy.

## Session: Industry Perspective card copy pass
- metrics.ts: removed MetricStat/stats support (IndustryMetric.value now required, added optional highlights: string[]).
- Card 2 is now a single +18% stat, label 'Conversions, Voice AI Beat Humans on Every Outcome', body 'Also +12% Offers and +17% 30-Day Retention for 70,000 people randomly assigned to a structured intake call with either a human or an AI voice agent.', highlights ['+12% Offers','+17% 30-Day Retention'].
- Card 4 (+45%) citation -> GrowthGurukul - Community Engagement Strategy, href https://growthgurukul.in/community-engagement-strategy-creating-fomo-loyalty/ (was Tharrett & Bedford / Amazon link).
- MetricFlipCard.tsx: dropped multi-stat rendering, added a Body sub-component that regex-splits the description and wraps highlight substrings in font-semibold text-mint; card min-h 13rem -> 15.5rem.
