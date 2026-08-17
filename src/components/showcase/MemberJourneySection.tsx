import Link from 'next/link'
import { CubeSmartMark } from '@/components/journey/EmeraldMark'

const acts = [
  {
    label: 'Act 1',
    title: 'Booking & move-in',
    body: 'Consent captured properly, a branded RCS unit carousel, a reservation, a one-tap move-in reminder, a mid-move packing-supplies pre-order and a post-move-in recap.',
  },
  {
    label: 'Act 2',
    title: 'The tenant needs a bigger unit',
    body: 'She books Thursday, then texts back in plain English that she needs to resize. The AI agent moves it in-thread without a human touching it.',
  },
  {
    label: 'Act 3',
    title: 'Locked out after hours',
    body: 'She calls the store at 8pm needing gate access reset. The store is closed. The voice AI verifies her and sends a new gate code with a QR code.',
  },
  {
    label: 'Act 4',
    title: 'The save',
    body: 'She calls back about a failed autopay charge, and the agent hands her to the store team with the whole story — and a real-time retention offer — already on screen.',
  },
]

const surfaces = [
  'Branded RCS carousels & chip lists',
  'Real Verify OTP + Lookup',
  'Inbound quick replies',
  'AI unit-resizing in-thread',
  'Inbound voice AI agent',
  'Unified Profile in Twilio Memory',
]

export function MemberJourneySection() {
  return (
    <section
      id="member-journey"
      className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center gap-3">
          <CubeSmartMark size={30} />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-glow">
            Guided Move-In Journey
          </span>
        </div>

        <h2 className="mt-5 max-w-3xl font-heading text-3xl font-semibold leading-tight md:text-5xl">
          One tenant. Four acts.
          <br />
          Every message and call is real.
        </h2>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
          Meet <span className="text-starwhite">Maya</span> — 31, just moved to Fort Worth, reserves a
          unit at the CubeSmart West 7th store. This isn&apos;t a dashboard of disconnected demos.
          It&apos;s a single guided narrative that runs to a real phone number over RCS, SMS and
          voice, with her Unified Profile filling in live as it happens.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {acts.map((act) => (
            <div
              key={act.label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-emerald/30"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-glow">
                {act.label}
              </span>
              <h3 className="mt-2 font-heading text-base font-semibold text-starwhite">
                {act.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">{act.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {surfaces.map((surface) => (
            <span
              key={surface}
              className="rounded-full border border-emerald/25 bg-emerald/[0.07] px-3 py-1.5 text-[11px] font-medium text-emerald-glow"
            >
              {surface}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/journey"
            className="rounded-xl bg-emerald px-7 py-3.5 font-heading text-sm font-semibold text-emerald-ink transition hover:bg-emerald-glow"
          >
            Enter the guided demo →
          </Link>
        </div>
      </div>
    </section>
  )
}
