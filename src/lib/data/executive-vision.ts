export interface Citation {
  citation: string
  href: string
}

export interface ExecutiveVisionCard {
  /** Large figure, e.g. "2–5×". */
  headline: string
  /** Short bold caption under the figure. */
  label: string
  /** Supporting paragraph. */
  body: string
  citations?: Citation[]
  /** Plain-text attribution used when there is no external source to link. */
  note?: string
}

export const executiveVisionHeadline = {
  main: "CubeSmart's 2026 inflection point is operating leverage, not just growth.",
  sub: 'Twilio is the intelligent communication layer inside the CubeSmart Management Platform that gets it there.',
}

export const executiveVisionCards: ExecutiveVisionCard[] = [
  {
    headline: '$57.3M',
    label: 'Incremental annual rental revenue',
    body: 'A +10% relative lift in call-to-lease conversion — from 35.0% to 38.5% — across 75,800 monthly inbound leads, by replacing traditional IVR with low-latency Voice AI and an instant, branded RCS booking carousel.',
    citations: [
      {
        citation: 'Self-Storage Industry Benchmark / Forrester TEI of Twilio',
        href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
      },
    ],
  },
  {
    headline: '$1.62M',
    label: 'Annual labor expense reduction',
    body: 'Automating 60%+ of payment recoveries with Branded RCS self-service removes 27,000 manual outreach tasks a month, reserving live agents for the tenants who actually need empathy and a fee waiver.',
    citations: [
      {
        citation: 'CubeSmart Q1 2026 10-Q',
        href: 'https://investors.cubesmart.com/',
      },
    ],
  },
  {
    headline: '$4.13M',
    label: 'Preserved annual NOI',
    body: 'Real-time retention offers — a discount or a unit downsize, surfaced to the agent the instant a competitor or dissatisfaction signal is detected — save just 5% of churn-risk calls and avoid expensive lease-up re-marketing.',
    note: 'CubeSmart + Twilio',
  },
]
