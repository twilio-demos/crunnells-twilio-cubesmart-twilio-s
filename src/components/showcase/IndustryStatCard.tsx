import type { IndustryMetric } from '@/lib/data/metrics'

/** A simple, static stat card — just the headline figure, its category, and a small
 *  source link. No flip interaction. */
export function IndustryStatCard({ metric }: { metric: IndustryMetric }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-mint/25 bg-white/5 p-5 backdrop-blur-sm md:p-6">
      <span className="text-3xl font-bold leading-none tracking-tight text-mint md:text-4xl">
        {metric.value}
      </span>
      <span className="mt-3 text-sm font-semibold leading-snug text-starwhite">
        {metric.label}
      </span>
      <a
        href={metric.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto pt-3 text-[10px] leading-snug text-white/35 underline decoration-white/20 decoration-dotted underline-offset-2 transition-colors hover:text-mint hover:decoration-mint/50"
      >
        {metric.citation}
      </a>
    </div>
  )
}
