import { opportunityStats } from '@/lib/data/metrics'

const storyColumns = [
  {
    who: 'KORE',
    role: 'The platform',
    color: '#6923f4',
    points: [
      'Embedded communications become a leasing and retention engine, not a support cost center.',
      'Every conversation — voice, SMS, RCS — becomes usable data that feeds pricing and churn models.',
      'New AI-native tiers create expansion revenue across the whole owned + managed portfolio.',
    ],
  },
  {
    who: 'The Store',
    role: "A CubeSmart property",
    color: '#ff7a1a',
    points: [
      'Never miss another lead — every call, text, and RCS tap gets an instant, on-brand response.',
      'Store teams spend time on move-ins and retention saves, not chasing missed calls.',
      'One unified view of every tenant across every channel, out of the box.',
    ],
  },
  {
    who: 'The Tenant',
    role: 'Renting a unit',
    color: '#74fbd0',
    points: [
      'Book, resize, and get gate access instantly, on whichever channel is already open.',
      'A concierge that remembers her unit, her move-in date, and her history — every time.',
      'Feels like a personal relationship with the store, not a transaction.',
    ],
  },
]

export function StorySection() {
  return (
    <section id="story" className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24 bg-deepspace-light/40">
      <div className="max-w-6xl mx-auto w-full">
        <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">The Opportunity</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl">
          Leveling up communications maturity compounds value for everyone in the chain
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          Moving from reactive, siloed channels to an AI-native, autonomous layer isn&apos;t just a
          feature upgrade — it reshapes the economics of the entire relationship, from KORE down to
          the tenant at the gate.
        </p>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {storyColumns.map((col) => (
            <div key={col.who} className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <span className="text-xs uppercase tracking-wide text-white/40">{col.role}</span>
              </div>
              <h3 className="text-xl font-semibold text-starwhite mb-4">{col.who}</h3>
              <ul className="space-y-3 text-sm text-white/70 leading-relaxed">
                {col.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: col.color }} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[28px] border border-mint/25 bg-black/30 p-8 md:p-12">
          <h3 className="font-heading text-2xl md:text-3xl font-bold leading-tight max-w-3xl text-starwhite">
            Build vs. buy is the real question — and for AI communications, the market has already
            answered it.
          </h3>
          <p className="mt-4 max-w-3xl text-sm md:text-base leading-relaxed text-white/60">
            Building in-house is expensive — in time, and in real dollars — and it&apos;s genuinely
            hard to get right. Buying trades that cost for a different risk: outsourcing away the
            customization and differentiation that should make the experience feel like CubeSmart&apos;s
            own. Twilio&apos;s advantage is that it doesn&apos;t force that trade-off — it provides
            the infrastructure and plumbing out of the box, while leaving KORE free to build the
            genuinely custom, differentiated capabilities on top.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-x-12 gap-y-8">
            {opportunityStats.map((stat) => (
              <div key={stat.lead} className="flex gap-3">
                <span className="mt-2 w-2 h-2 rounded-full bg-mint shrink-0" />
                <p className="text-sm md:text-base leading-relaxed text-white/60">
                  <span className="font-bold text-starwhite">{stat.lead}</span>
                  {stat.body && <> {stat.body}</>}{' '}
                  <a
                    href={stat.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`italic underline decoration-mint/50 text-mint/90 hover:text-mint transition-colors ${
                      stat.body ? '' : 'mt-1 block'
                    }`}
                  >
                    {stat.citation}
                  </a>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
