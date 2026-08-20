import type { IndustryMetric } from '@/lib/data/metrics'

/** A simple, static stat card — just the headline figure and its category.
 *  No flip interaction, no citation shown. */
export function IndustryStatCard({ metric }: { metric: IndustryMetric }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-mint/25 bg-white/5 p-5 backdrop-blur-sm md:p-6">
      <span className="text-3xl font-bold leading-none tracking-tight text-mint md:text-4xl">
        {metric.value}
      </span>
      <span className="mt-3 text-sm font-semibold leading-snug text-starwhite">
        {metric.label}
      </span>
    </div>
  )
}
