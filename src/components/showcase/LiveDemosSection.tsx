import { VerifyDemo } from './VerifyDemo'
import { AiConcierge } from './AiConcierge'
import { PhoneWorkspace } from './PhoneWorkspace'

export function LiveDemosSection({ phoneNumber }: { phoneNumber?: string }) {
  return (
    <section id="live-demos" className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24 bg-deepspace-light/40">
      <div className="max-w-6xl mx-auto w-full">
        <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">Try It Yourself</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl">
          These aren&apos;t mockups. They&apos;re live.
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          Everything below hits a real Twilio API — a live AI agent running on voice, chat, and SMS,
          a browser-embedded outbound call using the Client SDK with live call intelligence, and a
          real Verify OTP check. Imagine this running behind a CubeSmart leasing desk.
        </p>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          <PhoneWorkspace />
          <AiConcierge phoneNumber={phoneNumber} />
          <VerifyDemo />
        </div>
      </div>
    </section>
  )
}
