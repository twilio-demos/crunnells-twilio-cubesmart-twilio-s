# CubeSmart + Twilio | Guided Move-In Journey

An interactive, single-page presentation that shows how Twilio's communications platform embeds
directly inside **CubeSmart's Management Platform** to power an AI-native, multichannel self-storage
customer journey — from the first call about a unit, through booking and move-in, to gate access,
autopay recovery and retention.

## What's inside

- **Industry Perspective** — an opening framing statement introducing CubeSmart's 1,516-store
  portfolio and how Twilio embeds inside the CubeSmart Management Platform to power the tenant
  journey, followed by four simple stat cards (1,516 stores, +10% conversion lift, >52% missed-call
  loss, 190% ROI) — each shows just the headline figure and its category, no citation, no flip
  interaction.
- **Executive Vision** — CubeSmart's 2026 "inflection point" framing: defending NOI against rising
  operating expense. Three stat cards: **$57.3M** incremental annual rental revenue from higher
  call-to-lease conversion, **$1.62M** annual labor expense reduction from automated RCS payment
  recovery, and **$4.13M** preserved annual NOI from real-time retention offers.
- **The Opportunity** — a value story showing how maturity gains compound value for the Management Platform, the store,
  and the tenant, followed by a graceful build-vs-buy explanation (building in-house is expensive
  and hard; buying can outsource differentiation; Twilio provides the infrastructure out of the box
  while leaving the Management Platform free to build what's genuinely custom) and a sourced stats card citing Menlo
  Ventures, MIT NANDA, RAND, and the Stanford HAI AI Index.
- **Embedded Capabilities** — a device-mockup showcase illustrating the Guided Move-In voice AI,
  Branded Calling + Voice Insights, a branded RCS unit-browsing carousel, WhatsApp, and the unified
  store inbox — all shown as if embedded natively inside CubeSmart's own tools.
- **How Does It Work** — a colour-coded layer diagram: Tenant Touchpoints (store phone line, SMS,
  CubeSmart app, web booking, gate kiosk, email, RCS) → CubeSmart Management Platform → Unified Integration Layer →
  Twilio Agent Connect (TAC) → the Twilio Platform (Conversation Orchestrator, Memory, Intelligence,
  Relay, Voice & Messaging, Verify, Branded RCS, 10DLC/A2P), with a return path back up to the
  tenant's own channel.
- **CubeSmart AI-Native Communications Adoption Arch** — three independent, parallel lanes that
  each mature on their own timeline, with no single required order between them: **Messaging**
  (Alerts & Notifications → Marketing SMS → Emerging Channels, i.e. RCS, WhatsApp & FB Messenger →
  Omnichannel Conversations), **Voice** (Outbound Calling → Conversational Intelligence &
  Automations → Unified Inbound & Outbound Voice → Advanced Analytics & Automations), and **AI**
  (Enterprise Knowledge, Memory & Intelligence → Text-Based Agentic Flows → Autonomous Voice AI →
  Intelligent Multi-Channel Self-Service & Handoff), plus a **DIY / ⚡ Flex SDK** toggle that expands
  the surface into a fully-expanded "Embedded Flex SDK" card with a glowing perimeter around the
  three milestones it delivers natively. Clicking any stage opens its full breakdown — use cases,
  value for the store and for the CubeSmart Management Platform, and the Twilio building blocks behind it.
- **Live Demos** *(temporarily hidden)* — the "Try It Yourself" row is switched off while it is
  reworked. Flip `SHOW_LIVE_DEMOS` in `src/components/showcase/ShowcaseClient.tsx` back to `true` to
  restore the section and its nav entry. It contains a real WebRTC outbound call with live call
  intelligence, an AI Concierge chat, and a real Verify OTP flow.
- **Guided Move-In Journey** — a full-screen, narrative-driven demo that runs end-to-end to a real
  handset. See below.
- **Next Steps** — three proposed engagements: Technical Deep Dives, a POC Scoping Session, and an
  Onsite Hackathon.

## The Guided Move-In Journey

A separate, fully functional demo reached from the **Guided Move-In Journey** section (or directly
at `/journey`). It is deliberately *not* a single pane of glass with open-ended outcomes — it is a
scripted four-act story that only advances when the real thing happens on a real phone.

The workspace has three panes:

- **Story Rail** — the thirteen beats of Acts 0–4 in fixed order. Exactly one beat is active; the
  rest are locked. A beat is either *your turn* (one primary button) or *waiting on John*.
- **Stage** — becomes whatever the beat needs: the store's reservation page, the move-in-appointment
  mini-site, the after-hours call prompt, the live call transcript, or the live Twilio Flex handoff
  panel. His handset thread sits alongside it the whole way through.
- **Unified Profile** — Traits (Contact and lease state only), Events, Observations and reservation
  history, read live from Twilio Memory.

### The narrative

| Act | What happens |
| --- | --- |
| **0** | Set the scene: John, 31, just moved to Denver, reserves a unit at the West 7th store. |
| **1** | Reservation with explicit opt-in → live Twilio Lookup (real line type, carrier, RCS eligibility) → a real Verify code he has to enter → Memory profile created. Then a branded RCS welcome carousel (What to Bring, Parking & Loading Dock, Storage Rules & Insurance, Get Packing Supplies, Schedule Your Move-In), a move-in booking with a real confirmation, a reminder with Confirm / Running late / Reschedule chips, a mid-move Supply Shop carousel of three packing bundles, and a post-move-in recap with a 1–5 star staff rating. |
| **2** | He books Thursday, then replies in free text that he needs a bigger unit. A tightly scoped AI agent asks which day, returns the real open slots as tappable chips, cancels, rebooks and confirms — in the same thread. |
| **3** | He calls the store at 8pm locked out at the gate. The voice AI greets him **by name** (his first name is resolved from the live run, or from his Twilio Memory profile by phone number, *before* the greeting is spoken), then **waits** — it opens neutrally and will not name a reason for the call. Once he actually asks for gate access help it acknowledges the request, offers **1, 7 or 30 day** extended-access windows, reads the chosen end date back before committing, resets access, confirms the window out loud, asks whether there's anything else — and the RCS confirmation with his new gate code lands as he hangs up. |
| **4** | He calls back to check on his account; the agent greets him by name, tells him the extended access is still active, reacts warmly to his check-in — *glad you called* — then has to tell him the card on file has expired. It asks permission to bring in the store team, then hands the **live call into Twilio Flex** as a real TaskRouter voice task carrying his profile, reservation history, access window, failed charge, AI summary, the live intelligence signals and the last sixty seconds of transcript. A Flex agent accepts, is bridged straight to him, and sees all of that rendered on their desktop by the **CubeSmart Tenant Context** Flex plugin. Then, while he is giving the store team his new card, he starts venting — he found a cheaper unit down the street and isn't sure it's worth staying. **The operators are still listening**, his retention score climbs past 60, an event is written to his profile mid-call, and the recommended save appears on the agent's screen: 20% off his rent for three months, or a downsize to a smaller unit. He takes the discount, gives the card, and stays. |

Events fired to the Unified Profile along the way: **New Lease Started**, **Consent Captured**,
**Unit Reserved**, **Moving Supplies Ordered**, **Reservation Changed**, **Gate Access Extended**,
**Flex Escalation**, **Retention Risk Threshold Reached**, **Autopay Recovered & Lease Retained**.

### The operators keep listening after the handoff

This is the part of Act 4 that surprises people. Handing the call to a human does *not* end the
conversation as far as Twilio is concerned. ConversationRelay tears down, Real-Time Transcription
takes over on the same call, and — because the store number has bidirectional voice capture rules —
everything the tenant says to the **human** lands in the same Conversation Orchestrator conversation
as the AI stretch. In Twilio's words: *"the full interaction — AI portion and human portion — lives
in one conversation."*

So the same Language Operators keep scoring the human conversation, and two things happen without
anyone pressing anything:

- **The operators write back.** The first time the retention score crosses **60**, a
  **Retention Risk Threshold Reached** event is written to his Unified Profile in Twilio Memory,
  naming the score and the drivers behind it. It is authored by a Language Operator mid-call, not by
  a button in this app.
- **The agent gets coached in real time.** The recommended save is released onto the live Flex task
  the moment the threshold is crossed, so the offer appears on the agent's screen while he is still
  mid-sentence. The release is driven by the score itself and by the operators' own quoted evidence —
  never by this app having to hear him name a competitor, which is exactly why it used to stay
  silent during the human stretch of the call.

The demo screen mirrors the human leg of the transcript back from Conversation Orchestrator, so the
room can watch his words arrive and the score climb even though the AI agent has long since dropped
off the call.

### Keeping the voice agent on the rails

Three things stop the callback stalling, which is the failure mode a live audience notices:

- **It never repeats itself.** Every turn, the agent is shown the lines it has already spoken on this
  call and told not to say any of them, or anything meaning the same thing, again.
- **The payment check happens in the same breath as the check-in.** Reacting warmly and then
  checking the card happen in one turn, along with breaking the news and asking permission to bring
  in the store team.
- **It can hang up.** Once he confirms there is nothing else, the agent says one short goodbye and
  closes the line itself rather than leaving him holding a silent phone.

There is also a **Hand off to Flex now** control on the live call panel during Act 4. It performs the
same real transfer the agent would — same live call, same TaskRouter task, same context — so a stalled
agent can never strand a demo.

### Real-time Conversation Intelligence

While the call is still in progress, Twilio Language Operators score the live transcript and post
their results back to the journey service, which streams them onto the screen and patches them onto
the Flex task so the agent's panel updates mid-call. Four signals run:

| Signal | What it does | Where it shows |
| --- | --- | --- |
| **Call reason** | Resolves why he's calling — "Locked out / gate access" appears seconds in, with his own words as evidence and a confidence score. Deliberately reports *not clear yet* until he has actually said something. | Demo screen + Flex |
| **Sentiment** | Twilio's prebuilt sentiment operator, kept as a trail through the call rather than a single badge — so Act 4 visibly moves from positive to negative as his card is declined. | Demo screen + Flex |
| **Retention risk** | A 0–100 score with a band, a trend and the named drivers behind it. It climbs in Act 4 as he names a competitor or says he isn't sure the unit is worth it. | Demo screen + Flex |
| **Next best action** | The save offer a human should make — 20% off rent for 3 months, or a unit downsize — grounded in the store's own retention playbook stored in Twilio Enterprise Knowledge. It is **withheld until a save is genuinely owed**: released when the retention score crosses 60, or when the tenant's own words (on either leg of the call) name a competitor or raise moving out. Stays silent on routine calls. | **Flex only** |

The recommendation is delivered to the human at the store, in the moment, with the policy it came
from attached. It is **stripped out server-side** before state ever reaches the demo screen — not
merely hidden in the UI — so the room can never see the play the agent is about to make. Provisioning
lives in `server/provision-cintel.cjs` and is safe to re-run.

### It waits to be asked

Demo rooms are noisy, and a helpful model will happily run with a stray word it thinks it heard.
The greeting can't be interrupted, the agent is forbidden from being the first to mention access,
gate codes or billing, and gate access cannot be reset unless a genuine request appears in what the
tenant actually said on that call.

A **Reset demo** control deletes his Memory profile by phone number and clears all state for a
clean run.

The app is themed in a clean black/white palette with CubeSmart orange as the brand accent and
Neptune Blue/Mint reserved as the Twilio "platform" accent color. Typography is Poppins + Roboto.

## Setup required

Fill in any missing environment values **before** deploying — the app will not work without them.
The shared Twilio credentials (account SID, API key/secret, phone number) are pre-filled by default
— you only need to add app-specific values like `OPENAI_API_KEY` and the CubeSmart-specific values
below.

- **RCS sender branding** — the guided journey needs an RCS sender your test handset has accepted
  the tester invite for. In the Twilio Console, open **Messaging → RCS → Senders**, choose (or
  create) a sender, set its display name to **CubeSmart**, brand colour and logo, and set
  `CUBESMART_RCS_SENDER_ID` to it.
- **RCS test device** — the demo handset must be a test device on that sender and must have tapped
  **Make me a tester**. Without that, Twilio returns error `63035` and every message silently falls
  back to SMS. The journey workspace checks the sender on load and shows a warning banner if it is
  missing or not attached to the Messaging Service, and tags any individual message that fell back
  to SMS with the reason.
- **Voice** — point the store's phone number's voice webhook at `<journey service>/twiml`. The agent
  resolves who is calling first, then opens with their first name (for example *"Hi John, thanks for
  calling CubeSmart on West 7th — good to hear from you. What can I do for you?"*). Deploy once to
  bring it online.
- **Flex** — Act 4 performs a real handoff. The live call is redirected out of the AI agent and
  enqueued into the connected account's Flex TaskRouter workflow as a genuine voice task, with the
  tenant's full context on the task attributes. **Before running Act 4, log in to Flex at
  flex.twilio.com and set your status to Available** — logging in for the first time is also what
  creates your agent in the workspace. The journey workspace shows a live readiness chip and warns
  you if nobody is online, and the Act 4 panel shows the real task SID, queue, assignment status and
  which agent accepted.
- **Provisioning** — the CubeSmart Conversation Intelligence layer (Enterprise Knowledge retention
  playbook, the three custom Language Operators, the intelligence configuration) is created by a
  one-time setup route baked into the voice server itself: `POST <journey service>/journey/provision-intel`.
  It's idempotent — safe to call more than once, everything is looked up by display name first —
  and it prints its result (`knowledgeBaseId`, `operatorIds`, `configId`, `attached`) which should
  then be copied into the `CUBESMART_*` environment variables below. Deploy once, then trigger the
  route once (e.g. `curl -X POST <journey service>/journey/provision-intel`).
- **Reliable Flex handoff** — Act 4 tries a real Flex TaskRouter handoff first. If nobody is
  available in Flex, the live call automatically forwards straight to the store team's fallback
  phone (`FWD_NUMBER`) instead, so the demo always reaches a real person — no need to keep a Flex
  agent logged in just to run the demo. The Desk screen shows which path was actually used, plus a
  clear mockup of what a Flex agent's screen would show either way (tenant profile, call summary,
  retention risk, recommended save).

### Environment values

| Variable | Purpose |
| --- | --- |
| `CUBESMART_MESSAGING_SERVICE_SID` | Messaging Service the journey sends RCS/SMS through |
| `CUBESMART_RCS_SENDER_ID` | The branded RCS sender, e.g. `rcs:your_agent_id` |
| `CUBESMART_STORE_PHONE` | The store's phone number shown/dialled in the demo (falls back to `TWILIO_PHONE_NUMBER`) |
| `CUBESMART_VOICE_GREETING` | Fallback greeting when no tenant name can be resolved |
| `CUBESMART_INTEL_CONFIG_ID` | Intelligence configuration created by `provision-cintel.cjs` |
| `CUBESMART_KNOWLEDGE_BASE_ID` | Enterprise Knowledge base holding the retention playbook |
| `CUBESMART_OP_CALL_REASON` / `CUBESMART_OP_RETENTION_RISK` / `CUBESMART_OP_NEXT_BEST_ACTION` / `CUBESMART_OP_SENTIMENT` | The four Language Operator ids |
| `FLEX_WORKSPACE_SID` / `FLEX_WORKFLOW_SID` / `FLEX_TASK_QUEUE_SID` | TaskRouter routing targets for the Flex handoff |
| `FWD_NUMBER` | Fallback phone the live call forwards to when no Flex agent is available |
| `NEXT_PUBLIC_FLEX_URL` | Deep link to the Flex agent desktop |
| `NEXT_PUBLIC_VOICE_SERVER_URL` | Address of the live journey/voice service (falls back to `VOICE_SERVER_URL`, then `TWILIO_VOICE_PUBLIC_DOMAIN`) |

If the Flex or journey-service values are left blank the app falls back sensibly and re-resolves
what it can automatically, so the journey keeps working instead of showing "not connected yet".

### If this project was cloned

A clone gets its own journey/voice service address, but the Twilio account it talks to still points
at the **original** copy. These need to be repointed at the new address, or the demo will send
messages perfectly and then appear to ignore every tap and every call:

| Twilio setting | Where it lives | What it must point at |
| --- | --- | --- |
| Inbound messages | Messaging Service → inbound request URL | `<journey service>/journey/inbound` |
| Delivery receipts | Same Messaging Service → status callback | `<journey service>/journey/status` |
| Inbound calls | The store phone number → voice webhook | `<journey service>/twiml` |
| Intelligence results | `cubesmart-realtime` intelligence configuration | `<journey service>/journey/cintel` |

The Flex plugin is served by the journey service too, so a new plugin version has to be released
against the new address as well. `TWILIO_PHONE_NUMBER` / `CUBESMART_STORE_PHONE` must also be a
number that actually exists on the connected account.

Re-running `server/provision-cintel.cjs` repoints the intelligence webhook automatically from
`TWILIO_VOICE_PUBLIC_DOMAIN`; the rest are one-line updates in the Twilio Console.

## The Flex plugin — "CubeSmart Tenant Context"

Flex doesn't display custom task attributes anywhere by default, so the context the voice agent
hands over would otherwise be invisible to the human picking up. A plugin (`/flex-plugin`) fixes
that:

- **The large panel beside the call** becomes the tenant's record — the recommended save offer at
  the very top, then live call intelligence (call reason, sentiment, the retention risk meter and
  its drivers), then name, number and home store, unit type and account status, the extended access
  window and its length, the declined card and failed charge amount, units reserved, reservation
  history, usual Supply Shop order, last staff rating, why the AI escalated plus its written
  summary, the last stretch of the call transcript, and the Twilio Memory profile it all came from.
- **The task's Info tab** gets a condensed strip: unit type, account status, a card-expired flag,
  the retention risk band, what he's calling about, the recommended offer and the AI's summary.
- Tasks that didn't come from the voice agent say so, rather than rendering an empty shell.

The intelligence block keeps updating while the agent is on the call — new operator results are
merged onto the live task, so the risk score climbs on their screen as he talks.

It is served by the voice service itself at `/flex-plugin/cubesmart-tenant-context-<version>.js`
and registered through Twilio's Plugins API — which means the plugin ships and updates alongside
the rest of the project, with no CLI step.

`/flex-plugin` holds the same plugin as a conventional Flex plugin project for anyone who wants to
develop it against a local Flex instance or deploy it through Twilio's own plugin hosting. See
`flex-plugin/README.md`. The journey workspace reports whether the panel is live, so a missing
plugin is never discovered mid-demo.

## Why the welcome carousel photos are versioned

Twilio Content Templates are **immutable** — the artwork and copy are frozen when the template is
created, so editing the image URLs in the code does nothing on its own. Template names in
`server/src/journey/content.ts` therefore carry a version suffix; bumping it publishes a fresh
template.

### Why RCS can silently look like SMS

RCS Business Messaging works on Android and on iOS 18 or later, but an unlaunched (DRAFT) sender
can only reach handsets that accepted its tester invite. A Messaging Service configured for
RCS-first delivery will quietly retry over SMS the moment the RCS attempt is refused, so a
misconfigured sender looks identical to a working one. The journey records the channel that
actually carried each message — resolved from the delivery receipt, with a short polling backstop
— so a fallback is always visible rather than assumed.
