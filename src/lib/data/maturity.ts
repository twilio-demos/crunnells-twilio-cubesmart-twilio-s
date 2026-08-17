export interface UseCase {
  title: string
  description: string
}

/** A value-list bullet. Plain strings get auto-flagged with a "[source missing]" tag if they
 *  contain a quantified claim (%, $, or an "Nx" figure). Use the object form with `sourced: true`
 *  to suppress that tag — either because the figure is explicitly labeled as an average/estimate,
 *  or because it's backed by a real citation. When a citation is available, supply `citation` +
 *  `href` and it renders as a small clickable link under the bullet, the same way the Industry
 *  Perspective metrics at the top of the page cite their sources. For a bullet backed by more than
 *  one source, use `citations` instead — an array of `{ citation, href }` pairs rendered as
 *  separate small links, same visual style, side by side. */
export type ValueBullet =
  | string
  | {
      text: string
      sourced: true
      citation?: string
      href?: string
      citations?: { citation: string; href: string }[]
    }

/** A single maturing capability tile inside one of the three streams. */
export interface StreamStage {
  id: string
  name: string
  tagline: string
  icon: string
  description: string
  techStack: string[]
  useCases: UseCase[]
  studioValue: ValueBullet[]
  bmsValue: ValueBullet[]
}

export type StreamId = 'messaging' | 'voice' | 'ai'

/** One of the three parallel, independently-maturing capability streams. */
export interface Stream {
  id: StreamId
  name: string
  shortLabel: string
  description: string
  color: string
  stages: StreamStage[]
}

/** The Flex SDK embed — not a 4th sequential stream, a shortcut around the other three. */
export interface FlexShortcut {
  id: string
  name: string
  tagline: string
  icon: string
  description: string
  techStack: string[]
  useCases: UseCase[]
  studioValue: ValueBullet[]
  bmsValue: ValueBullet[]
  color: string
}

export const streams: Stream[] = [
  {
    id: 'messaging',
    name: 'Messaging Stream',
    shortLabel: 'Messaging',
    description: 'From one-way alerts to a single omnichannel thread across every messaging surface.',
    color: '#f44e27',
    stages: [
      {
        id: 'msg-alerts',
        name: 'Alerts & Notifications',
        tagline: 'Where most stores start today',
        icon: '🔔',
        description:
          'One-way and two-way-capable SMS/MMS on a single Twilio number for time-sensitive alerts — failed autopay charges, gate code reminders, move-in day confirmations. This is the foundation most CubeSmart stores already have live.',
        techStack: ['Programmable Messaging API', 'US A2P 10DLC', 'Usage API'],
        useCases: [
          {
            title: 'Automated Failed Autopay Recovery',
            description: 'Instant SMS alerts with one-click payment links the moment a recurring unit rent charge fails — before it becomes a delinquency.',
          },
          {
            title: 'Gate Code & Move-In Day Reminders',
            description: 'Automatically texts the gate code, unit number and building directions the morning of move-in, and re-sends it if access fails.',
          },
        ],
        studioValue: [
          {
            text: 'Automating 60%+ of payment recoveries via RCS/SMS self-service removes 27,000 manual outreach tasks a month across the portfolio, saving ~$1.62M annually in call center operating expenses.',
            sourced: true,
            citation: 'CubeSmart Q1 2026 10-Q',
            href: 'https://investors.cubesmart.com/',
          },
        ],
        bmsValue: [
          {
            text: 'Proves Clear ROI: automated collections recover thousands in monthly rent that would otherwise require a manual call, accelerating cash collection cycles by 4+ days and lowering credit loss reserves.',
            sourced: true,
          },
        ],
      },
      {
        id: 'msg-marketing',
        name: 'Marketing SMS',
        tagline: 'Promotional campaigns & retention drips',
        icon: '📣',
        description:
          'Scheduled and triggered campaign sends — move-in specials, seasonal packing promotions, win-back offers for tenants who moved out — layered onto the same compliant number, with opt-in/opt-out management built in.',
        techStack: ['Messaging Campaigns', 'Opt-in/Opt-out Management', 'Scheduled Sends'],
        useCases: [
          {
            title: 'First 90-Day Move-In Drip',
            description: 'Scheduled SMS milestones celebrate a completed move-in and recommend add-ons like insurance, locks and packing supplies.',
          },
          {
            title: 'Lapsed-Tenant Win-Back Campaign',
            description: 'A scheduled sequence re-engages former tenants who vacated in the last 12 months with a targeted move-back offer.',
          },
        ],
        studioValue: [
          {
            text: 'Elevating baseline call-to-lease conversion from 35.0% to 38.5% (+10% relative lift) yields +2,653 additional leases per month — roughly $57.3M in incremental annual recurring revenue at an ARPU of $150/month.',
            sourced: true,
            citation: 'Self-Storage Industry Benchmark / Forrester TEI of Twilio',
            href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
          },
          {
            text: 'Personalized SMS re-engagement workflows targeting recently-vacated tenants and seasonal movers drive meaningful re-lease uplift across the portfolio.',
            sourced: true,
            citation: 'McKinsey & Company, \u201cWhat Is Personalization?\u201d McKinsey Explainers',
            href: 'https://www.mckinsey.com/featured-insights/mckinsey-explainers/what-is-personalization',
          },
        ],
        bmsValue: [
          {
            text: 'ARPU Expansion & Net Revenue Retention (NRR) Growth — achieve NRR rates above 113% by monetizing expansion features like insurance and move-in add-ons, generating 7%+ more NRR when embedding high-value workflows vs. basic platforms.',
            sourced: true,
            citation: 'McKinsey & Company, \u201cThe Net Revenue Retention Advantage: Driving Success in B2B Tech\u201d',
            href: 'https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-net-revenue-retention-advantage-driving-success-in-b2b-tech',
          },
          {
            text: 'Churn Reduction via Workflow Embeddedness — deeply embedded multi-feature workflows maintain top-quartile Gross Revenue Retention (GRR) of 88\u201392%+, driving 43.6% average annual revenue growth vs. just 13.1% for platforms with poor retention.',
            sourced: true,
            citation: 'Subjolt, \u201cNRR & GRR Benchmarks\u201d Guide',
            href: 'https://www.subjolt.com/guides/nrr-grr-benchmarks/',
          },
        ],
      },
      {
        id: 'msg-emerging-channels',
        name: 'Emerging Channels',
        tagline: 'RCS, WhatsApp & FB Messenger extend reach',
        icon: '🌐',
        description:
          'RCS, WhatsApp, and Facebook Messenger extend reach beyond plain SMS with richer, branded, interactive experiences — unit carousels, dynamic gate QR codes, quick replies — giving tenants more ways to engage than a single text thread.',
        techStack: ['RCS Business Messaging', 'WhatsApp Business API', 'Facebook Messenger'],
        useCases: [
          {
            title: 'Guided Move-In via Branded RCS Carousel',
            description: 'Interactive rich cards trigger mid-call, showing unit images, pricing and floor maps with an embedded 1-click "Book Now" action.',
          },
          {
            title: 'Smart Access & Gate Coordination',
            description: 'Rich cards containing dynamic QR codes and turn-by-turn gate directions replace plain-text gate code reminders — scannable straight from the lock screen.',
          },
        ],
        studioValue: [
          {
            text: 'RCS achieves up to a 10x higher CTR than plain SMS due to branded, visual cards & automated payment processing support.',
            sourced: true,
            citation: 'Google, RCS Business Messaging \u2014 Telco Deck',
            href: 'https://developers.google.com/static/business-communications/rcs-business-messaging/files/rbm-telco-deck.pdf#:~:text=Upgrade%20to%20RCS%20Business%20Messaging%20for%20better,an%20upgrade.%20Page%209.%20compared%20to%20SMS.',
          },
          {
            text: 'Revenue & ROI Influence: case studies published by Google confirm that RCS campaigns drive an 115% increase in message-generated revenue, a 140% uptake in promotional offers, and up to 6.2x higher ROI than legacy SMS channels.',
            sourced: true,
            citation: 'Google, RCS for Business \u2014 Success Stories',
            href: 'https://rcsforbusiness.google/resources/success-story/#:~:text=With%20RCS%20for%20Business%2C%20BigHaat%20improved%20return,omnichannel%20campaign%20and%20saw%202x%20higher%20ROI',
          },
        ],
        bmsValue: [
          'Differentiated channel vs. competitors still on plain-text SMS — RCS lets KORE package a high-margin premium messaging add-on (e.g., "Advanced Rich Messaging Tier") to drive Net Revenue Retention (NRR) across owned and third-party managed stores.',
          'Churn deflection — keeps communications native to KORE instead of losing tenants to 3rd-party inbox tools or a competitor\u2019s more responsive channel.',
        ],
      },
      {
        id: 'msg-omnichannel-conversations',
        name: 'Omnichannel Conversations',
        tagline: 'One thread, powered by Conversations API (Classic)',
        icon: '🧵',
        description:
          'Every channel used so far — SMS, RCS, WhatsApp, and Facebook Messenger — comes together in one persistent, stateful thread via Twilio Conversations API (Classic), so a tenant\u2019s conversation lives in one place instead of being rebuilt from scratch every time they switch channels or stores.',
        techStack: ['Twilio Conversations API (Classic)', 'Cross-Session Continuity', 'Conversation History'],
        useCases: [
          {
            title: 'Persistent Support Threads',
            description: 'Store staff see the full back-and-forth with a tenant instead of a single disconnected text, even across multiple visits and multiple stores.',
          },
          {
            title: 'Real-Time Bi-Directional Chat',
            description: 'Push-based events replace legacy server polling for instant unit-availability and rate-change alerts.',
          },
        ],
        studioValue: [
          'Faster store team response, full context on screen — no more waiting for the UI to update with new messages',
          'Seamless cross-channel support across webchat, SMS, RCS, WhatsApp, and Facebook Messenger for every store in the portfolio',
        ],
        bmsValue: [
          'A single conversational data model KORE can build every future channel on top of, across all 1,516 owned and managed stores',
          {
            text: 'Ongoing maintenance typically costs 15% to 20% of initial build cost annually. Leveraging Twilio\u2019s OOTB solution reduces tech-debt and code complexity, allowing KORE to focus on the highest-value, differentiated work.',
            sourced: true,
            citation: 'The Code, \u201cBuild vs. Buy Framework\u201d',
            href: 'https://thecodev.co.uk/build-vs-buy-framework/',
          },
        ],
      },
    ],
  },
  {
    id: 'voice',
    name: 'Voice Stream',
    shortLabel: 'Voice',
    description: 'From simple branded outbound calling to advanced, rules-driven call handling at scale.',
    color: '#6923f4',
    stages: [
      {
        id: 'voice-outbound',
        name: 'Outbound Calling',
        tagline: 'Client SDK + Branded Calling',
        icon: '📞',
        description:
          'Store and call-center staff place outbound calls straight from KORE using the Client SDK, with a verified name and reason shown on the recipient\u2019s screen via Branded Calling — no separate phone system required.',
        techStack: ['Client SDK', 'Programmable Voice', 'Enhanced Branded Calling'],
        useCases: [
          {
            title: 'Call-from-KORE for Store Teams',
            description: 'A leasing agent or collections rep calls a lead or a past-due tenant straight from the tool they already work in — no separate desk phone.',
          },
          {
            title: 'Branded Outbound Outreach',
            description: 'Outbound calls display "CubeSmart" and the reason for calling right on the tenant\u2019s screen — 72% of consumers never answer calls from unknown or unverified numbers, while 78% are willing to answer when caller ID shows a recognized business name and logo.',
          },
        ],
        studioValue: [
          {
            text: 'Multi-channel outreach generates 93% higher response rates, while streamlining the leasing and collections workflow.',
            sourced: true,
            citation: 'HubSpot, \u201cState of Sales\u201d',
            href: 'https://blog.hubspot.com/sales/state-of-sales',
          },
          {
            text: 'Displaying a verified business name, brand logo, and call reason via branded caller ID increases mobile call answer rates by 25% to 56%+ compared to unbranded dials, while decreasing call decline rates by 50%, and generates a 498% ROI over three years for outbound contact centers.',
            sourced: true,
            citation: 'FCC, Triennial Report',
            href: 'https://docs.fcc.gov/public/attachments/DOC-416732A1.pdf',
          },
        ],
        bmsValue: [
          {
            text: 'High-Margin Incremental Add-On Revenue for franchise & third-party managed store agreements, packaged as a native trust-and-verify add-on pass-through.',
            sourced: true,
          },
          'Enterprise Competitive Moat: 854 third-party managed properties require verified caller ID to maintain brand trust across locations. Native branded calling gives KORE a distinct platform advantage, driving stickiness and higher switching costs for managed accounts.',
        ],
      },
      {
        id: 'voice-cintel',
        name: 'Conversational Intelligence & Automations',
        tagline: 'Every call summarized straight to KORE',
        icon: '🧠',
        description:
          'Layer Conversational Intelligence onto every call — automatic transcription, sentiment scoring, and structured call dispositions written straight to KORE without manual note-taking. Real-time intent analysis automatically scores leads, surfaces instant next-best action suggestions, flags churn signals, and empowers store teams to continuously refine the leasing experience.',
        techStack: ['Conversational Intelligence (CINTEL)', 'Automated Call Dispositions', 'Voice Insights'],
        useCases: [
          {
            title: 'CINTEL Summaries, Sentiment & Dispositions',
            description: 'Every call is transcribed, summarized, and scored for sentiment, with dispositions posted to KORE via webhook.',
          },
          {
            title: 'Voice Insights for Smarter Call Timing',
            description: 'Time-of-day answer-rate data tells leasing and collections staff exactly when to call for the highest pickup rate and ROI.',
          },
        ],
        studioValue: [
          'Automatically update KORE with disposition, run post-call automations, capture observations, and generate trends and analysis at scale — across every store.',
          {
            text: 'Utilizing AI conversation intelligence achieves 35% higher win rates through real-time surfacing of next best actions.',
            sourced: true,
            citation: 'Landbase, \u201cGo-to-Market Statistics 2026\u201d',
            href: 'https://www.landbase.com/blog/go-to-market-statistics',
          },
        ],
        bmsValue: [
          {
            text: 'KORE packages Twilio Voice Intelligence as a native module — a 15% increase in agent productivity and AHT reduction, offsetting the 5.8% YoY rise in same-store operating expense driven by personnel costs.',
            sourced: true,
            citation: 'CubeSmart Q1 2026 10-Q / Forrester TEI of Twilio',
            href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
          },
          'Core Data Enrichment simultaneously lays the groundwork for hydrating tenant profiles for later AI agent use-cases.',
        ],
      },
      {
        id: 'voice-inbound-routing',
        name: 'Unified Inbound & Outbound Voice',
        tagline: 'The big picture: outbound and inbound, one platform',
        icon: '☎️',
        description:
          'The big picture this stream has been building toward: outbound calling, inbound calling, voicemail, hold/wait queues, and advanced routing driven by business rules (time of day, store, delinquency tier) all live on ONE platform and one number. Inbound voice, voicemail, call queues, and rules-based routing are the sub-capabilities that make that unification real — every call, in either direction, lands with the right person, at the right store.',
        techStack: ['Inbound Voice', 'Voicemail', 'Call Queues', 'Rules-Based Routing'],
        useCases: [
          {
            title: 'One Screen, Every Call',
            description: 'Store and regional teams never leave KORE — calls, voicemail, and routing all live in the same screen already used for leasing and billing.',
          },
          {
            title: 'Unified Call Handling Toolkit',
            description: 'Voicemail, warm call transfer, a shared regional inbox, and Conversational Intelligence scoring apply automatically to every call, inbound or outbound, across all 1,516 stores.',
          },
        ],
        studioValue: [
          'Faster first-contact resolution and simpler tenant experience — one number for SMS, RCS and voice at every store, not a separate leasing line and a separate billing line.',
          'Staff Efficiency & Frictionless Store Operations: streamlines daily workflows with automated tenant insights populated directly inside KORE, while natively supporting multi-store call overflow and shared routing across owned and managed properties.',
        ],
        bmsValue: [
          {
            text: 'KORE becomes the "Business Operating System" for the portfolio — vertical platforms with embedded finance and communications command a 45% to 95% valuation multiple premium over standalone horizontal software.',
            sourced: true,
            citation: 'Windsor Drake, \u201cVertical SaaS Valuation Report Q4 2025\u201d',
            href: 'https://windsordrake.com/vertical-saas-valuation-report-q4-2025/',
          },
          {
            text: 'High-Margin ARPU Expansion & Churn Reduction: platforms with deeply embedded, multi-channel workflow capabilities maintain Gross Revenue Retention (GRR) of 88% to 92%+, while expansion products increase Net Revenue Retention (NRR) above 110%, enabling 1.5x to 3x faster annual growth.',
            sourced: true,
            citation: 'ChartMogul, \u201cSaaS Retention Report\u201d',
            href: 'https://chartmogul.com/reports/saas-retention-report/',
          },
        ],
      },
      {
        id: 'voice-analytics',
        name: 'Advanced Analytics & Automations',
        tagline: 'Platform-wide trends & automations at scale',
        icon: '📊',
        description:
          'With enough call volume flowing through CINTEL across inbound and outbound, aggregate trends, custom language operators for QA/compliance, and early-warning churn signals become visible across all 1,516 stores — and power automated workflows off the back of what they reveal, not just dashboards to read.',
        techStack: ['Aggregated CINTEL Analytics', 'Custom Language Operators', 'Early-Warning Signals', 'Automated Workflows'],
        useCases: [
          {
            title: 'Platform-Wide Sentiment Benchmarking',
            description: 'Compare call sentiment and disposition trends across every owned and third-party managed store from one dashboard.',
          },
          {
            title: 'Generative Operators & Cross-Channel Observability',
            description: 'Configure generative custom operators to auto-detect disclosures, script adherence, call scoring, competitor mentions, and even AI agent observability across every interaction.',
          },
        ],
        studioValue: [
          'Early-warning churn signals surfaced from call sentiment trends — competitor pricing mentions, dissatisfaction language — before a cancellation or move-out notice.',
          'Leverage aggregated anonymized network data across all 1,516 stores to show regional managers exactly how their occupancy, lead conversion, and delinquency rates compare against portfolio benchmarks.',
          {
            text: 'Decision Speed, Efficiency & KPI Target Achievement: utilizing anonymized peer benchmarking improves operational decision-making and identifies efficiency gaps 20% to 30% faster, enabling regional leaders to recalibrate goals and drive a 15% to 25% increase in operational KPI achievement.',
            sourced: true,
            citation: 'Gartner & Forrester Research',
          },
        ],
        bmsValue: [
          'Aggregated data unlocks numerous opportunities, including Peer Performance Benchmarking across owned vs. third-party managed stores, a real-time pulse on tenant sentiment (unmet demand, early warning signals, quality assurance), and KORE-provided AI-driven Prescriptive Playbooks powered by platform-wide success patterns.',
          {
            text: 'KORE can package real-time sentiment analytics and automated churn warning alerts as a premium feature module for third-party managed properties.',
            sourced: true,
          },
          {
            text: 'Platforms offering proprietary peer benchmark insights increase feature adoption rates by 25%.',
            sourced: true,
            citation: 'ChartMogul, \u201cSaaS Retention Report\u201d',
            href: 'https://chartmogul.com/reports/saas-retention-report/',
          },
        ],
      },
    ],
  },
  {
    id: 'ai',
    name: 'AI Stream',
    shortLabel: 'AI',
    description: 'From a text agent bolted onto messaging, to one unified agent across every channel.',
    color: '#74fbd0',
    stages: [
      {
        id: 'ai-knowledge-memory',
        name: 'Enterprise Knowledge, Memory & Intelligence',
        tagline: 'Grounded answers, persistent memory & real-time intelligence',
        icon: '📚',
        description:
          'The foundation the agent will run on: Enterprise Knowledge RAG grounds answers in real store policy documentation — gate hours, insurance terms, late-fee rules — Conversation Memory remembers a tenant\u2019s unit and preferences across sessions and channels without ever resending a full chat log, and Conversational Intelligence adds sentiment and quality signals on every exchange from day one.',
        techStack: ['Enterprise Knowledge RAG', 'Conversation Memory', 'Conversational Intelligence (CINTEL)'],
        useCases: [
          {
            title: 'Persistent Cross-Session Memory',
            description: 'Remembers tenant preferences (e.g. "prefers ground-floor drive-up access") and recalls them on the next interaction, any channel.',
          },
          {
            title: 'Digital-to-Physical KORE Sync',
            description: 'Extracted memories (e.g. "recently mentioned a competitor\u2019s lower rate") auto-populate the store team\u2019s screen the moment a tenant calls or checks in.',
          },
        ],
        studioValue: [
          'Out-of-the-Box Intelligence: KORE consumes each store\u2019s unstructured policy documents, including gate hours, insurance terms, late-fee schedules, and access rules, allowing AI agents to deliver verified responses without training or tuning models.',
          'ROI-Rich Personalization: instead of a generic "come back!" text, the AI sends a targeted message: "Your 10x10 at West 7th is still available — want to lock in your old rate before it\u2019s gone?"',
        ],
        bmsValue: [
          'KORE unlocks hyper-personalized, portfolio-wide Agentic Memory as a native "Tenant Concierge & Profile Memory Engine" that automatically hydrates tenant profiles across leasing touchpoints and is leveraged by agents downstream in KORE.',
          'KORE positions itself as an enterprise-grade platform capable of executing multi-store SOPs with zero policy deviation across owned and third-party managed properties, creating a strong competitive moat against legacy storage management systems.',
        ],
      },
      {
        id: 'ai-messaging-hookup',
        name: 'Text-Based Agentic Flows',
        tagline: 'An AI agent joins the messaging thread',
        icon: '🤖',
        description:
          'Twilio Agent Connect (TAC) hooks an AI agent into whatever messaging channel is already live — answering FAQs, booking a unit — with no voice dependency at all. This can start on day one, in parallel with the Messaging and Voice streams.',
        techStack: ['Twilio Agent Connect (TAC)', 'Text-Based AI Agent'],
        useCases: [
          {
            title: '24/7 Autonomous Text AI Leasing Concierge',
            description: 'Answers unit availability, pricing, and gate-hour questions the moment a prospect texts, any time of day.',
          },
          {
            title: 'Automate Unit Resizing & Upsell Campaigns',
            description: 'Move a tenant to a bigger or smaller unit and run powerful RCS and SMS upsell campaigns for locks, boxes and insurance.',
          },
        ],
        studioValue: [
          {
            text: '24/7 Resolution & Booking System: deflects 80% of transactional inquiries to reduce operational costs by 30%, while automatically keeping units filled.',
            sourced: true,
            citation: 'Gartner, \u201cGartner Predicts Agentic AI Will Autonomously Resolve 80% of Common Customer Service Issues Without Human Intervention by 2029\u201d',
            href: 'https://www.gartner.com/en/newsroom/press-releases/2025-03-05-gartner-predicts-agentic-ai-will-autonomously-resolve-80-percent-of-common-customer-service-issues-without-human-intervention-by-20290',
          },
          {
            text: 'Zero-Latency Speed-to-Lead Conversion: engaging inbound leasing inquiries via automated RCS or SMS within 60 seconds captures prospect intent at its peak — increasing lead qualification rates by up to 21x and driving higher inquiry-to-lease conversions without increasing leasing labor.',
            sourced: true,
            citation: 'Harvard Business Review, \u201cThe Short Life of Online Sales Leads\u201d',
            href: 'https://store.hbr.org/product/the-short-life-of-online-sales-leads/F1103B',
          },
        ],
        bmsValue: [
          {
            text: 'High-margin Add-ons: embedding AI workflow automation commands a price premium, enabling KORE to increase ARPU across mid-market and enterprise/third-party managed tiers.',
            sourced: true,
          },
          'Platform Stickiness & Reduced Platform Churn: embedding deep, autonomous AI workflows directly into leasing, billing, and access control elevates KORE from an admin tool to an essential business system, lowering platform churn and deepening the competitive moat.',
        ],
      },
      {
        id: 'ai-voice-joins',
        name: 'Autonomous Voice AI',
        tagline: 'The leasing concierge picks up the phone',
        icon: '🎙️',
        description:
          'The same knowledge and memory now answer the phone too. Sub-0.5 second voice AI handles bookings, pricing questions, and gate access by voice, and can hand a session from voice into text mid-conversation — the "Guided Move-In" multimodal booking engine.',
        techStack: ['ConversationRelay', 'Conversation Orchestrator', 'Voice-to-Text Session Stitching'],
        useCases: [
          {
            title: 'Sub-0.5s Voice AI Leasing Desk',
            description: 'Handles after-hours calls to check unit availability, quote pricing, book a move-in appointment, or reset gate access — over natural speech.',
          },
          {
            title: 'Voice-to-SMS Session Stitching',
            description: 'Converts a voice leasing call into an instant RCS carousel with unit photos, pricing and a 1-click "Book Now" action.',
          },
        ],
        studioValue: [
          {
            text: 'Self-storage is an acute-need purchase; over 52% of leads are lost if an inbound inquiry is missed or delayed. Voice AI gives 100% immediate containment instead.',
            sourced: true,
            citation: 'White Label Storage / Industry Research',
            href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
          },
          {
            text: 'Sub-5-minute speed-to-lead drives dramatically higher conversion — the exact gap Voice AI closes by picking up every call, every time, at every one of 1,516 stores.',
            sourced: true,
            citation: 'Harvard Business Review, \u201cThe Short Life of Online Sales Leads\u201d',
            href: 'https://store.hbr.org/product/the-short-life-of-online-sales-leads/F1103B',
          },
        ],
        bmsValue: [
          {
            text: 'Premium Voice Add-Ons: monetizing the AI leasing concierge as a high-margin add-on module boosts store-level ARPU, capturing top-tier software margins on direct phone automation.',
            sourced: true,
          },
          'Telephony is Sticky: embedding autonomous AI Voice Agents directly into store phone lines, leasing, and collections elevates KORE\u2019s value and stability even further across the portfolio.',
        ],
      },
      {
        id: 'ai-unified',
        name: 'Intelligent Multi-Channel Self-Service & Handoff',
        tagline: 'One agent, every channel, real-time safety net',
        icon: '✨',
        description:
          'One AI identity fluently handles every channel in a single conversation, observed in real time by Conversational Intelligence for sentiment and competitor mentions — a tenant thinking about leaving for a cheaper unit down the street is handed off to a human, with a real-time retention offer already on their screen, before it becomes a lost lease.',
        techStack: ['Real-Time Conversational Intelligence', 'Unified Agent Identity', 'Human Handoff Guardrails'],
        useCases: [
          {
            title: 'Predictive Save-the-Deal (Churn Prevention)',
            description: 'Real-time NLP on the live voice stream tags "moving out" or a competitor name, and Agent Copilot pushes a targeted retention offer — 20% off for three months, or a downsize — to the agent mid-call.',
          },
          {
            title: 'Cross-Channel Session Continuity',
            description: 'A conversation started by voice can finish by text, and vice versa, with zero repeated context — and the updated gate code lands by RCS the moment the call ends.',
          },
        ],
        studioValue: ['Native KORE UI Embed: integrates calls, messaging, and agent-to-human handoff with complete context directly inside KORE for the ultimate platform solution'],
        bmsValue: [
          {
            text: 'Valuation Multiple Premium: vertical platforms with embedded communications command a 45% to 95% valuation multiple premium over standalone software.',
            sourced: true,
            citations: [
              { citation: 'Meritech, \u201cMeritech Software Pulse \u2014 July 2, 2026\u201d', href: 'https://meritech.substack.com/p/meritech-software-pulse-02-july-2026' },
              { citation: '733Park, \u201cEmbedded Payments & M&A\u201d', href: 'https://www.733park.com/guides/embedded-payments-ma/' },
            ],
          },
        ],
      },
    ],
  },
]

export const flexShortcut: FlexShortcut = {
  id: 'embedded-flex',
  name: 'Embedded Flex SDK',
  tagline: 'Flex SDK — embedded natively, without walking every stop',
  icon: '🧩',
  description:
    'This is not a fourth stream — it\u2019s an accelerator. Embedding the Flex SDK, TaskRouter, and Twilio Studio directly into KORE gives every store native omnichannel communication controls, task routing, and call/chat handling — plus Agent Copilot for real-time retention offers — in one integration, instead of building up each stream stage by stage.',
  techStack: ['Flex SDK', 'TaskRouter', 'Twilio Studio', 'Serverless Functions'],
  useCases: [
    {
      title: 'Omnichannel Orchestration & Live Escalation',
      description: 'Programmatically handle multi-channel interactions and dynamically escalate active tasks within the application flow (e.g., escalating a live webchat or failed-autopay call to a voice call with a store team member).',
    },
    {
      title: 'Agent Copilot for Retention & Collections',
      description: 'Real-time sentiment detection on late-fee and competitor-pricing conversations surfaces a suggested waiver, discount or unit downsize directly on the agent\u2019s screen, sourced from KORE\u2019s own retention playbook.',
    },
  ],
  studioValue: [
    'Eliminate context-switching between separate tools: store and regional staff can handle calls & messages within the exact same screen used for leasing and billing.',
    'Complete tenant journey insights, robust analytics and reporting for regional leaders, and native corporate centralization support across owned and managed properties.',
  ],
  bmsValue: [
    'Development Velocity & Component Reuse: out-of-the-box infrastructure provides pre-built WebRTC media handling, global carrier connectivity, state synchronization, and an extensible task routing engine. Engineers only need to write the application-level plugin code connecting Flex SDK to KORE.',
    {
      text: 'Valuation Multiple Premium: vertical platforms with embedded communications command a 45% to 95% valuation multiple premium over standalone software.',
      sourced: true,
      citation: '733Park, \u201cEmbedded Payments & M&A\u201d',
      href: 'https://www.733park.com/guides/embedded-payments-ma/',
    },
  ],
  color: '#ecfd91',
}
