import { architectureStages } from '@/lib/data/architecture'

function Connector({ color }: { color: string }) {
  return <div className="w-px h-8 mx-auto" style={{ background: `${color}66` }} />
}

function ChipRow({ chips, color }: { chips: { label: string; active?: boolean }[]; color: string }) {
  return (
    <div className="relative mt-4">
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `${color}40` }} />
      <div className="flex flex-wrap justify-center gap-2.5 pt-4">
        {chips.map((chip) => (
          <div key={chip.label} className="relative flex flex-col items-center">
            <div className="absolute -top-4 w-px h-4" style={{ background: `${color}40` }} />
            <span
              className={`text-[11px] px-2.5 py-1.5 rounded-full border ${
                chip.active ? 'border-mint text-mint bg-mint/10' : 'border-white/15 text-white/60'
              }`}
            >
              {chip.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Decorative return path: bottom layer (Twilio Platform) back up to Layer 1, showing that Twilio
 *  is what actually meets the member on the channel they started on. */
function ReturnPath() {
  const red = '#f22f46'
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute hidden md:block top-[4.5rem] bottom-[6rem] left-1/2 right-0 ml-[14rem]"
    >
      <div
        className="absolute inset-0 rounded-r-3xl border-y-2 border-r-2"
        style={{ borderColor: `${red}66` }}
      />
      <span
        className="absolute -top-[9px] -left-[2px] text-[15px] leading-none"
        style={{ color: red }}
      >
        ◀
      </span>
    </div>
  )
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24 bg-deepspace-light/40">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">How Does It Work</span>
        </div>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl">
          One integration layer. One CubeSmart Management Platform. Twilio underneath.
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          A reference architecture for how CubeSmart&apos;s Management Platform connects tenant touchpoints
          to Twilio&apos;s orchestration and communications layer, portfolio-wide.
        </p>

        <div className="mt-14 relative">
          <ReturnPath />

          <div className="relative flex flex-col items-center">
            {architectureStages.map((stage, i) => (
              <div key={stage.id} className="w-full flex flex-col items-center">
                <div
                  className="w-full max-w-md rounded-2xl border p-5 text-center"
                  style={{ borderColor: `${stage.accent}59`, background: `${stage.accent}0f` }}
                >
                  <h3 className="text-base font-semibold text-starwhite">{stage.title}</h3>
                  {stage.description && (
                    <p className="mt-2 text-xs text-white/60 leading-relaxed">{stage.description}</p>
                  )}
                  {stage.chips && <ChipRow chips={stage.chips} color={stage.accent} />}
                </div>
                {i < architectureStages.length - 1 && (
                  <Connector color={architectureStages[i + 1].accent} />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-[11px] text-white/40 text-center md:hidden">
          ↑ Twilio delivers the response back to the tenant on the channel they started on.
        </p>
      </div>
    </section>
  )
}
