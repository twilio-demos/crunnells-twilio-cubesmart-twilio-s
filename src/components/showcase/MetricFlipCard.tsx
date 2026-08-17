'use client'

import { useState } from 'react'
import type { IndustryMetric } from '@/lib/data/metrics'

const cardShell =
  'flip-face flex flex-col rounded-2xl border bg-white/5 backdrop-blur-sm p-4 md:p-5'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Renders the body copy, colouring any highlighted figures in the accent mint. */
function Body({ text, highlights }: { text: string; highlights?: string[] }) {
  if (!highlights?.length) return <>{text}</>

  const pattern = new RegExp(`(${highlights.map(escapeRegExp).join('|')})`, 'g')

  return (
    <>
      {text.split(pattern).map((chunk, i) =>
        highlights.includes(chunk) ? (
          <span key={`${chunk}-${i}`} className="font-semibold text-mint">
            {chunk}
          </span>
        ) : (
          <span key={`t-${i}`}>{chunk}</span>
        ),
      )}
    </>
  )
}

/** A stat card that starts showing only its headline figure and flips on click to reveal the
 *  full context and source. Stays on whichever face was last chosen. */
export function MetricFlipCard({ metric }: { metric: IndustryMetric }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flip-card h-full">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${metric.label} — show details`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFlipped((f) => !f)
          }
        }}
        className={`flip-inner h-full min-h-[15.5rem] cursor-pointer select-none ${flipped ? 'is-flipped' : ''}`}
      >
        {/* Back face — the full detail, kept in normal flow so it sets the card height. */}
        <div
          className={`${cardShell} flip-face-back h-full border-white/10 hover:border-mint/40 transition-colors`}
          aria-hidden={!flipped}
        >
          <div className="flex min-h-[2.5rem] items-start md:min-h-[2.75rem]">
            <div className="text-2xl font-bold leading-tight text-mint md:text-3xl">{metric.value}</div>
          </div>
          <div className="mt-3 text-xs md:text-sm font-semibold text-starwhite leading-snug">{metric.label}</div>
          <div className="mt-1.5 mb-3 text-[11px] text-white/50 leading-snug">
            <Body text={metric.description} highlights={metric.highlights} />
          </div>
          <a
            href={metric.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-auto block border-t border-white/10 pt-2.5 text-[10px] leading-snug text-white/35 underline decoration-white/20 decoration-dotted underline-offset-2 transition-colors hover:text-mint hover:decoration-mint/50"
          >
            {metric.citation}
          </a>
        </div>

        {/* Front face — headline figure only. */}
        <div
          className={`${cardShell} absolute inset-0 items-center justify-center text-center border-mint/30 ${
            flipped ? '' : 'mint-glow-ring'
          }`}
          aria-hidden={flipped}
        >
          <span className="text-4xl md:text-5xl font-bold leading-none tracking-tight text-mint">
            {metric.value}
          </span>
        </div>
      </div>
    </div>
  )
}
