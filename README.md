# Xplor + Twilio | Platform Showcase

An interactive, single-page presentation that showcases how the Twilio communications platform
embeds inside an ISV like **Mariana Tek** (owned by **Xplor Technologies**) to power AI-native
member experiences for boutique fitness studios. **Barry's** is used throughout as the illustrative
Mariana Tek customer / end-consumer brand.

## What's inside

- **Industry Perspective** — why AI-native communications matter, shown as four flip cards that
  start as the headline figure alone (21×, +18%, +39%, +45%) and turn over on click to
  reveal the full claim and its linked source.
- **Executive Vision** — the payments-to-communications framing, headlined "You already ran this
  playbook with embedded payments. Embedded communications is the second act." Three stat cards:
  **2–5×** revenue per customer when a vertical platform embeds a capability natively (a16z),
  **2–4× increase** in valuation for platforms with payments and communications embedded against a
  3.4–3.6× SaaS median (733Park, Meritech), and **Zero** orchestration Xplor builds — Xplor builds
  the agent, Twilio handles everything between it and the member (no external citation, a strategic
  conclusion).
- **The Opportunity** — a value story showing how maturity gains compound value for the platform
  (Mariana Tek), its customer (Barry's), and the end member, followed by a sourced stats card —
  "When it comes to build vs. buy, the market has already decided: for AI communications, building
  in-house is the losing play" — citing Menlo Ventures, MIT NANDA, RAND, and the Stanford HAI AI
  Index, each linking out to the original source.
- **Embedded Capabilities** — a device-mockup showcase (Barry's-branded) illustrating
  ConversationRelay, Branded Calling + Voice Insights, RCS and WhatsApp as one centered row of four
  handsets. The AI Voice Concierge and Rich, Two-Way Messaging handsets start as still frames with a
  pulsing green ring and a play badge, and swap to their full animation when clicked — so the row is
  calm until someone chooses what to watch. A centered control above the row (arrow, two beads,
  arrow) flips the whole row to the staff-side desktop view — the unified Conversations inbox
  (messaging and voice in one view) — and flips back. Everything is shown as if embedded natively
  inside Barry's app.
- **How Does It Work** — a colour-coded layer diagram: Member Touchpoints (studio phone line, SMS,
  branded app, web booking, front-desk kiosk, email, RCS) → BMS Platforms (Mariana Tek + others) →
  Xplor Centralized AI Harness → Twilio Agent Connect (TAC) → the Twilio Platform (Conversation
  Orchestrator, Memory, Intelligence, Relay, Voice & Messaging, Verify, Branded Calling, 10DLC/A2P),
  with a return path from the Twilio Platform back up to the member's own channel.
- **Xplor Technologies AI-Native Communications Adoption Arch** — three independent, parallel lanes
  that each mature on their own timeline, with no single required order between them: **Messaging**
  (Alerts & Notifications → Marketing SMS → Emerging Channels, i.e. RCS, WhatsApp & FB Messenger →
  Omnichannel Conversations, i.e. every channel unified into one persistent thread via Conversations
  API (Classic)), **Voice** (Outbound Calling → Conversational Intelligence & Automations → Unified
  Inbound & Outbound Voice → Advanced Analytics & Automations), and **AI** (Enterprise Knowledge,
  Memory & Intelligence → Text-Based Agentic Flows → Autonomous Voice AI → Intelligent Multi-Channel
  Self-Service & Handoff). Tiles are compact (icon, name, tagline), with a "Start here"/"Day 1
  ready" tag on the natural entry points. The
  headline, intro paragraph, and legend always stay centered at a fixed width; the lanes themselves
  are centered while the **DIY / ⚡ Flex SDK** pill toggle (right of the legend) is on DIY, then the
  whole surface expands and the lanes shift left the moment Flex SDK is switched on, making room for
  a single, fully-expanded **"Embedded Flex SDK"** card to the right (it stacks below the lanes on
  smaller screens) — no separate click-to-open step. While Flex SDK mode is on and the screen is
  large enough for the side-by-side layout, a glowing yellow perimeter traces from the Flex SDK card
  around Messaging's Omnichannel Conversations tile, fully around the entire Voice Stream, and around
  the AI stream's Unified Omnichannel Agent tile — illustrating that those three milestones are what
  the Flex SDK gives a studio natively. It's one continuous outline (not separate boxes with wires)
  with narrow bridges where Omnichannel Conversations and Unified Omnichannel Agent connect into it,
  the Voice Stream's boundary sits above its own label so nothing is cut off, and a single line runs
  from the center of the Voice Stream envelope out to the Flex SDK card. Switching back to DIY
  instantly removes the card and the perimeter and re-centers the lanes. Clicking any stage opens
  its full breakdown below the lanes — use cases, value for the studio and for the BMS, and the
  Twilio building blocks behind it.
- **Live Demos** *(temporarily hidden)* — the "Try It Yourself" row is switched off while it is
  reworked. Flip `SHOW_LIVE_DEMOS` in `src/components/showcase/ShowcaseClient.tsx` back to `true` to
  restore the section and its nav entry. It contains:
  - **Office Softphone + Live Call Intelligence** — a real WebRTC voice call (Twilio Voice Client
    SDK) embedded like a staff desk phone, paired with a live Conversational Intelligence panel
    (Language Operators, transcript, sentiment, summary, and a call disposition that syncs back to
    the BMS) for an outbound "calling a lead" scenario.
  - **AI Concierge** — a live chat wired to the voice/chat/SMS AI agent backend in `/server`.
  - **Secure Verify** — a real Twilio Verify OTP send/check flow.
- **Guided Member Journey (Emerald Fitness)** — a full-screen, narrative-driven demo that runs
  end-to-end to a real handset. See below.
- **Next Steps** — three proposed engagements: Technical Deep Dives (per-stream working sessions with
  Twilio solutions engineers), a POC Scoping Session (Twilio Enterprise Strategy with Xplor
  architecture/product leads, output is a written scope), and an Onsite Hackathon (multi-day, led by
  Twilio Solution Acceleration Architects, deliverable is a working prototype).

## The Guided Member Journey — "Emerald Fitness"

A separate, fully functional demo reached from the **Guided Member Journey** section (or directly
at `/journey`). It is deliberately *not* a single pane of glass with open-ended outcomes — it is a
scripted four-act story that only advances when the real thing happens on a real phone.

The workspace has three panes:

- **Story Rail** — the thirteen beats of Acts 0–4 in fixed order. Exactly one beat is active; the
  rest are locked. A beat is either *your turn* (one primary button) or *waiting on Maya*.
- **Stage** — becomes whatever the beat needs: the studio signup page, the class-booking
  mini-site, the after-hours call prompt, the live call transcript, or the live Twilio Flex handoff
  panel. Her handset thread sits alongside it the whole way through.
- **Unified Profile** — Traits (Contact and Membership only), Events, Observations and class
  history, read live from Twilio Memory.

### The narrative

| Act | What happens |
| --- | --- |
| **0** | Set the scene: Maya, 31, just moved to Fort Worth, signs up at the West 7th studio. |
| **1** | Signup with explicit opt-in → live Twilio Lookup (real line type, carrier, RCS eligibility) → a real Verify code she has to enter → Memory profile created. Then a branded RCS welcome carousel (What to Bring, Parking, Gym Etiquette, Get Fuel at the Bar, Schedule a Class), a booking with a real confirmation, a reminder with Confirm / Running late / Cancel chips, a mid-class Fuel Bar carousel of three shakes, and a post-class stats recap with a 1–5 star instructor rating. |
| **2** | She books Thursday, then replies in free text that she can't make it. A tightly scoped AI agent asks which day, returns the real open Friday slots as tappable chips, cancels, rebooks and confirms — in the same thread. |
| **3** | She calls the studio at 8pm and it's closed. The voice AI greets her **by name** (her first name is resolved from the live run, or from her Twilio Memory profile by phone number, *before* the greeting is spoken), then **waits** — it opens neutrally and will not name a reason for the call. Once she actually asks to pause her membership it acknowledges the request, offers **30, 60 or 90 day** holds, reads the chosen end date back before committing, places the hold, confirms the dates and length out loud, asks whether there's anything else — and the RCS confirmation lands as she hangs up. |
| **4** | She calls back; the agent greets her by name, tells her the hold is still on, reacts warmly when she asks to come back — *that's great news, welcome back* — then has to tell her the card on file has expired. It asks permission to bring in the desk, then hands the **live call into Twilio Flex** as a real TaskRouter voice task carrying her profile, class history, hold dates, failed charge, AI summary, the live intelligence signals and the last sixty seconds of transcript. A Flex agent accepts, is bridged straight to her, and sees all of that rendered on their desktop by the **Emerald Fitness Member Context** Flex plugin. Then, while she is giving the desk her new card, she starts venting — she isn't seeing results, and she hurt herself in class. **The operators are still listening**, her retention score climbs past 60, an event is written to her profile mid-call, and the recommended save appears on the agent's screen: a one-time class credit and a fifteen minute personal coaching consultation. She takes it, gives the card, and stays. |

Events fired to the Unified Profile along the way: **New Account Created**, **Consent Captured**,
**Class Booked**, **Fuel Bar Order Placed**, **Class Cancelled**, **Membership Paused**,
**Flex Escalation**, **Retention Risk Threshold Reached**, **Membership Reactivated**.

### The operators keep listening after the handoff

This is the part of Act 4 that surprises people. Handing the call to a human does *not* end the
conversation as far as Twilio is concerned. ConversationRelay tears down, Real-Time Transcription
takes over on the same call, and — because the studio number has bidirectional voice capture rules —
everything the member says to the **human** lands in the same Conversation Orchestrator conversation
as the AI stretch. In Twilio's words: *"the full interaction — AI portion and human portion — lives
in one conversation."*

So the same Language Operators keep scoring the human conversation, and two things happen without
anyone pressing anything:

- **The operators write back.** The first time the retention score crosses **60**, a
  **Retention Risk Threshold Reached** event is written to her Unified Profile in Twilio Memory,
  naming the score and the drivers behind it. It is authored by a Language Operator mid-call, not by
  a button in this app.
- **The agent gets coached in real time.** The recommended save is released onto the live Flex task
  the moment the threshold is crossed, so the offer appears on the agent's screen while she is still
  mid-sentence. The release is driven by the score itself and by the operators' own quoted evidence —
  never by this app having to hear her say the word "cancel", which is exactly why it used to stay
  silent during the human stretch of the call.

The demo screen mirrors the human leg of the transcript back from Conversation Orchestrator, so the
room can watch her words arrive and the score climb even though the AI agent has long since dropped
off the call. Only her side, and only from after the handoff — during the AI stretch this app already
holds the authoritative transcript, and Orchestrator's copy of it is not one-to-one (each spoken
reply is split into several communications), so mirroring both would double every line.

### Keeping the voice agent on the rails

Three things stop the callback stalling, which is the failure mode a live audience notices:

- **It never repeats itself.** Every turn, the agent is shown the lines it has already spoken on this
  call and told not to say any of them, or anything meaning the same thing, again. Without that it
  will happily re-read the hold end date every turn while the conversation goes nowhere.
- **The payment check happens in the same breath as the welcome back.** Reacting warmly and then
  checking the card used to be two separate turns, which meant the agent stopped and waited for her
  to speak again — and if she was waiting for it, the call simply hung. Both now happen in one turn,
  along with breaking the news and asking permission to bring in the desk.
- **It can hang up.** Once she confirms there is nothing else, the agent says one short goodbye and
  closes the line itself rather than leaving her holding a silent phone.

There is also a **Hand off to Flex now** control on the live call panel during Act 4. It performs the
same real transfer the agent would — same live call, same TaskRouter task, same context — so a stalled
agent can never strand a demo.

The AI only speaks at three beats, and at each one it receives a narrow prompt built from live
demo state plus only the tools that beat allows — so it stays on script instead of behaving like
an open-ended chatbot.

### Real-time Conversation Intelligence

While the call is still in progress, Twilio Language Operators score the live transcript and post
their results back to the journey service, which streams them onto the screen and patches them onto
the Flex task so the agent's panel updates mid-call. The patch is coalesced but always runs a
trailing pass, and the task is re-resolved from TaskRouter if it did not exist yet at handoff — so
the newest retention score is never the one that gets dropped. Four signals run:

| Signal | What it does | Where it shows |
| --- | --- | --- |
| **Call reason** | Resolves why she's calling — "Membership hold" appears seconds in, with her own words as evidence and a confidence score. Deliberately reports *not clear yet* until she has actually said something. | Demo screen + Flex |
| **Sentiment** | Twilio's prebuilt sentiment operator, kept as a trail through the call rather than a single badge — so Act 4 visibly moves from positive to negative as her card is declined. | Demo screen + Flex |
| **Retention risk** | A 0–100 score with a band, a trend and the named drivers behind it. It climbs in Act 4 as she says she isn't really using her membership and isn't seeing results. | Demo screen + Flex |
| **Next best action** | The save offer a human should make — a one-time class credit together with a fifteen minute personal coaching consultation — grounded in the studio's own retention playbook stored in Twilio Enterprise Knowledge, and cited back to it. It is **withheld until a save is genuinely owed**: released when the retention score crosses 60, or when the member's own words (on either leg of the call) raise cancellation, dissatisfaction or an injury. Stays silent on routine calls, so Act 3's straightforward hold produces no recommendation at all. | **Flex only** |

The last one is the point of the whole act: the voice agent is explicitly *not* authorised to make
that offer, and is instructed to acknowledge her frustration without reaching for a gesture. The
recommendation is delivered to the human at the desk, in the moment, with the policy it came from
attached. It is **stripped out server-side** before state ever reaches the demo screen — not merely
hidden in the UI — so the room can never see the play the agent is about to make. The demo screen
does show which operator last ran and how long it took, so the panel reads as measurement rather
than animation.

Three custom operators (`Emerald Call Reason`, `Emerald Retention Risk`, `Emerald Next Best Action`)
plus Twilio's prebuilt Sentiment operator run from one intelligence configuration attached to the
account's live conversation configuration. Results only reach the screen when they came from a voice
channel, so her RCS and SMS turns in Acts 1–2 don't clutter it. If the intelligence layer ever goes
quiet the demo carries on untouched — the panel simply says it's waiting. Provisioning lives in
`server/provision-cintel.cjs` and is safe to re-run.

### It waits to be asked

Demo rooms are noisy, and a helpful model will happily run with a stray word it thinks it heard.
Three things stop the voice agent guessing why the member is calling:

- **At the audio level** — the greeting can't be interrupted, interrupt sensitivity is turned down,
  and anything captured while the agent is still speaking is discarded, so a cough or a nearby
  conversation never arrives as if the member had spoken.
- **In its instructions** — the opening line is strictly neutral. The agent is forbidden from being
  the first to mention a hold, a pause, cancelling, travel or billing, and is told to ask the member
  to repeat herself rather than fill in a blank.
- **As a hard guard** — the hold cannot be placed unless a genuine request appears in what the
  member actually said on that call. If it doesn't, the action is refused and the agent is told to
  ask her what she's calling about instead.

A **Reset demo** control deletes her Memory profile by phone number and clears all state for a
clean run.

The app is themed in a clean black/white palette inspired by Barry's real brand, with Mariana
Tek's Neptune Blue/Mint reserved as the "platform" accent color. The guided journey section uses
its own Emerald Fitness green. Typography is Poppins + Roboto.

## Setup required

Fill in any missing environment values **before** deploying — the app will not work without them.
The shared Twilio credentials (account SID, API key/secret, phone number) are pre-filled.

- **RCS sender branding** — the guided journey sends from the RCS sender `Wilke Worldwide` on the
  connected Twilio account. That sender was chosen because the demo handset has already accepted
  its tester invitation, which is the only reason RCS renders at all on an unlaunched sender. In
  the Twilio Console, open **Messaging → RCS → Senders** and change its display name to
  **Emerald Fitness**, set the brand colour and upload the logo/banner. The sender ID itself does
  not change, so no code change is needed.
- **RCS test device** — the demo handset must be a test device on that sender and must have tapped
  **Make me a tester**. Without that, Twilio returns error `63035` and every message silently
  falls back to SMS. The journey workspace now checks the sender on load and shows a warning
  banner if it is missing or not attached to the Messaging Service, and tags any individual
  message that fell back to SMS with the reason.
- **Voice** — the studio number's voice webhook is already pointed at the Railway service. The
  agent resolves who is calling first, then opens with their first name (for example *"Hi Maya,
  thanks for calling Emerald Fitness on West 7th — good to hear from you. What can I do for you?"*).
  Deploy once to bring it online.
- **Flex** — Act 4 performs a real handoff. The live call is redirected out of the AI agent and
  enqueued into the connected account's Flex TaskRouter workflow as a genuine voice task, with the
  member's full context on the task attributes. **Before running Act 4, log in to Flex at
  flex.twilio.com and set your status to Available** — logging in for the first time is also what
  creates your agent in the workspace. The journey workspace shows a live readiness chip and warns
  you if nobody is online, and the Act 4 panel shows the real task SID, queue, assignment status
  and which agent accepted.

### Environment values used by the Flex handoff

| Variable | Purpose |
| --- | --- |
| `FLEX_WORKSPACE_SID` | TaskRouter workspace behind the Flex instance |
| `FLEX_WORKFLOW_SID` | Workflow the escalated call is enqueued into ("Assign to Anyone") |
| `FLEX_TASK_QUEUE_SID` | Queue used for readiness reporting |
| `NEXT_PUBLIC_FLEX_URL` | Deep link to the Flex agent desktop |

All four are pre-filled from the connected account's live Flex configuration, and are re-resolved
automatically from Flex if the instance is ever rebuilt.

### Connecting the guided journey to its service

The guided journey talks to the separately-hosted voice/journey service.

| Setting | What it does |
| --- | --- |
| `NEXT_PUBLIC_VOICE_SERVER_URL` | Address of the live journey/voice service |

If it is ever left blank the app falls back to `VOICE_SERVER_URL`, and then to
`TWILIO_VOICE_PUBLIC_DOMAIN` (the same host, already set for the Twilio voice webhooks), so the
journey keeps working instead of showing "the journey service is not connected yet".

### If this project was cloned

A clone gets its own journey/voice service address, but the Twilio account it talks to still points
at the **original** copy. Four things have to be repointed at the new address, or the demo will send
messages perfectly and then appear to ignore every tap and every call:

| Twilio setting | Where it lives | What it must point at |
| --- | --- | --- |
| Inbound messages | Messaging Service → *Emerald Fitness* → inbound request URL | `<journey service>/journey/inbound` |
| Delivery receipts | Same Messaging Service → status callback | `<journey service>/journey/status` |
| Inbound calls | The studio phone number → voice webhook | `<journey service>/twiml` |
| Intelligence results | `emerald-fitness-realtime` intelligence configuration | `<journey service>/journey/cintel` |

The Flex plugin is served by the journey service too, so a new plugin version has to be released
against the new address as well. `TWILIO_PHONE_NUMBER` / `EMERALD_STUDIO_PHONE` must also be a
number that actually exists on the connected account — otherwise the journey tells the room to call
a number that isn't there.

Re-running `server/provision-cintel.cjs` repoints the intelligence webhook automatically from
`TWILIO_VOICE_PUBLIC_DOMAIN`; the rest are one-line updates in the Twilio Console.

## The Flex plugin — "Emerald Fitness Member Context"

Flex doesn't display custom task attributes anywhere by default, so the context the voice agent
hands over would otherwise be invisible to the human picking up. A plugin (`/flex-plugin`) fixes
that:

- **The large panel beside the call** becomes the member's record — the recommended save offer at
  the very top, then live call intelligence (call reason, sentiment, the retention risk meter and
  its drivers), then name, number and home studio, membership tier and status, the hold window and
  its length, the declined card and failed charge amount, classes booked, class history, usual Fuel
  Bar order, last instructor rating, why the AI escalated plus its written summary, the last stretch
  of the call transcript, and the Twilio Memory profile it all came from.
- **The task's Info tab** gets a condensed strip: tier, membership status, a card-expired flag, the
  retention risk band, what she's calling about, the recommended offer and the AI's summary.
- Tasks that didn't come from the voice agent say so, rather than rendering an empty shell.

The intelligence block keeps updating while the agent is on the call — new operator results are
merged onto the live task, so the risk score climbs on their screen as she talks.

It is **already released** on the connected Flex account, so agents get it automatically with no
install. The running build is served by the voice service itself at
`/flex-plugin/emerald-member-context-<version>.js` and registered through Twilio's Plugins API —
which means the plugin ships and updates alongside the rest of the project, with no CLI step.

`/flex-plugin` holds the same plugin as a conventional Flex plugin project for anyone who wants to
develop it against a local Flex instance or deploy it through Twilio's own plugin hosting. See
`flex-plugin/README.md`. The journey workspace reports whether the panel is live, so a missing
plugin is never discovered mid-demo.

## Why the welcome carousel photos are versioned

Twilio Content Templates are **immutable** — the artwork and copy are frozen when the template is
created, so editing the image URLs in the code does nothing on its own. Template names in
`server/src/journey/content.ts` therefore carry a version suffix; bumping it publishes a fresh
template. The welcome carousel is on `v2` because two of the original stock photos (Parking and Get
Fuel at the Bar) stopped being served and rendered as broken cards on the handset.

### Why RCS can silently look like SMS

RCS Business Messaging works on Android and on iOS 18 or later, but an unlaunched (DRAFT) sender
can only reach handsets that accepted its tester invite. A Messaging Service configured for
RCS-first delivery will quietly retry over SMS the moment the RCS attempt is refused, so a
misconfigured sender looks identical to a working one. The journey now records the channel that
actually carried each message — resolved from the delivery receipt, with a short polling backstop
— so a fallback is always visible rather than assumed.
