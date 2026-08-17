export interface OpportunityStat {
  lead: string
  body: string
  citation: string
  href: string
}

export const opportunityStats: OpportunityStat[] = [
  {
    lead: '76% of enterprise AI use cases are now bought, not built',
    body: 'up from 53% just a year earlier. The build-it-yourself era ended in 2025.',
    citation: '(Menlo Ventures, 2025)',
    href: 'https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/',
  },
  {
    lead: '~95% of enterprise generative-AI pilots deliver no measurable P&L return.',
    body: 'The model was never the bottleneck — the orchestration around it is.',
    citation: '(MIT NANDA, 2025)',
    href: 'https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/',
  },
  {
    lead: 'AI projects fail at roughly 2× the rate of ordinary IT projects.',
    body: '',
    citation: '(RAND, 2024)',
    href: 'https://www.rand.org/pubs/research_reports/RRA2680-1.html',
  },
  {
    lead: 'LLM inference got ~280× cheaper in 18 months',
    body: 'at a fixed capability level. Reasoning is now a commodity; the durable moat is the communications layer on top.',
    citation: '(Stanford HAI AI Index, 2025)',
    href: 'https://hai.stanford.edu/ai-index/2025-ai-index-report',
  },
]

export interface IndustryMetric {
  /** Single headline figure. */
  value: string
  label: string
  description: string
  /** Substrings of `description` to render in the accent colour. */
  highlights?: string[]
  citation: string
  href: string
}

export const industryMetrics: IndustryMetric[] = [
  {
    value: '1,516',
    label: 'Stores Across the Portfolio',
    description:
      '662 owned and 854 third-party managed properties (~104.8M sq. ft.) — every one of them scalable on the same Twilio-in-CubeSmart-Management-Platform communications layer.',
    citation: 'CubeSmart Q1 2026 Earnings Release',
    href: 'https://investors.cubesmart.com/',
  },
  {
    value: '+10%',
    label: 'Relative Lift in Call-to-Lease Conversion',
    description:
      'Elevating the industry-average 35% call-to-lease conversion rate to 38.5% with Voice AI and instant, rich visual booking — worth roughly $57.3M in incremental annual rental revenue at scale.',
    highlights: ['38.5%', '$57.3M'],
    citation: 'Self-Storage Industry Benchmark / Forrester TEI of Twilio',
    href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
  },
  {
    value: '>52%',
    label: 'Of Leads Lost to a Missed or Delayed Call',
    description:
      'Self-storage is an acute-need purchase — unassisted or missed calls drop conversion by more than half. Voice AI and Branded RCS give 100% immediate containment, every time the phone rings.',
    highlights: ['100% immediate containment'],
    citation: 'White Label Storage / Industry Research',
    href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
  },
  {
    value: '190%',
    label: 'ROI, Under 6-Month Payback',
    description:
      'Replacing a legacy, siloed voice and messaging stack with one Twilio-powered layer inside the CubeSmart Management Platform — with a 15% lift in agent productivity along the way, offsetting the 5.8% YoY rise in same-store operating expense.',
    highlights: ['15% lift in agent productivity'],
    citation: 'Forrester Total Economic Impact™ of Twilio / CubeSmart Q1 2026 10-Q',
    href: 'https://www.twilio.com/en-us/resources/analyst-reports/forrester-tei',
  },
]
