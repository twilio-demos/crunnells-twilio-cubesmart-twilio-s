'use client'

import { useEffect, useRef, useState } from 'react'
import { NavRail, type NavSection } from './NavRail'
import { HeroSection } from './HeroSection'
import { ExecutiveVisionSection } from './ExecutiveVisionSection'
import { StorySection } from './StorySection'
import { CapabilitiesSection } from './CapabilitiesSection'
import { HowItWorksSection } from './HowItWorksSection'
import { LiveDemosSection } from './LiveDemosSection'
import { MemberJourneySection } from './MemberJourneySection'
import { MaturitySection } from './MaturitySection'
import { ClosingSection } from './ClosingSection'

/**
 * "Try It Yourself" (the live demos row) is temporarily hidden while we iterate
 * on it — flip this back to true to bring the section and its nav entry back.
 */
const SHOW_LIVE_DEMOS = false

const sections: NavSection[] = [
  { id: 'perspective', label: 'Industry Perspective' },
  { id: 'executive-vision', label: 'Executive Vision' },
  { id: 'story', label: 'The Opportunity' },
  { id: 'capabilities', label: 'Embedded Capabilities' },
  { id: 'maturity', label: 'Adoption Arch' },
  ...(SHOW_LIVE_DEMOS ? [{ id: 'live-demos', label: 'Live Demos' }] : []),
  { id: 'member-journey', label: 'Guided Move-In Journey' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'closing', label: 'Next Steps' },
]

export function ShowcaseClient({ phoneNumber }: { phoneNumber?: string }) {
  const [activeId, setActiveId] = useState(sections[0].id)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)

    // Track the visibility ratio of every section and always activate whichever one is
    // currently MOST visible. A fixed single threshold (e.g. 0.5) never fires for sections
    // taller than the viewport (like the Maturity Framework tile+detail-panel layout), since
    // their intersection ratio can never reach 0.5 — that made their nav dot look "stuck".
    const ratios = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.intersectionRatio)
        })

        let bestId: string | null = null
        let bestRatio = 0
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        })
        if (bestId && bestRatio > 0) setActiveId(bestId)
      },
      { root: containerRef.current, threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scroll-smooth no-scrollbar bg-deepspace text-starwhite"
    >
      <NavRail sections={sections} activeId={activeId} onSelect={scrollToSection} />
      <HeroSection />
      <ExecutiveVisionSection />
      <StorySection />
      <CapabilitiesSection />
      <MaturitySection />
      {SHOW_LIVE_DEMOS && <LiveDemosSection phoneNumber={phoneNumber} />}
      <MemberJourneySection />
      <HowItWorksSection />
      <ClosingSection />
    </div>
  )
}
