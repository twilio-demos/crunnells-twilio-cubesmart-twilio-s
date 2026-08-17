import { capabilities } from '@/lib/data/capabilities'
import { CapabilitiesCarousel } from './CapabilitiesCarousel'

export function CapabilitiesSection() {
  const phones = capabilities.filter((cap) => !cap.wide)
  const desktop = capabilities.find((cap) => cap.wide)

  return (
    <section id="capabilities" className="min-h-screen snap-start flex flex-col justify-center py-24">
      <div className="max-w-6xl mx-auto w-full px-6 md:px-16">
        <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">Embedded in the Platform</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl">
          Every Twilio channel, embedded natively inside KORE
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          This is what it looks like when Twilio&apos;s full communications stack is embedded directly
          inside CubeSmart&apos;s tenant experience — from the first call about a unit to gate access
          and autopay recovery. No separate app, no context switch.
        </p>
      </div>

      <div className="mt-12">
        <CapabilitiesCarousel phones={phones} desktop={desktop} />
      </div>
    </section>
  )
}
