import { executiveVisionHeadline, executiveVisionCards } from '@/lib/data/executive-vision'

export function ExecutiveVisionSection() {
  return (
    <section
      id="executive-vision"
      className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24 relative overflow-hidden"
    >
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-mint/10 blur-3xl" />
      <div className="absolute bottom-0 -right-24 w-80 h-80 rounded-full bg-neptune/20 blur-3xl" />

      <div className="relative max-w-6xl mx-auto w-full">
        <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">Executive Vision</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl text-starwhite">
          {executiveVisionHeadline.main}
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          {executiveVisionHeadline.sub}
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {executiveVisionCards.map((card) => (
            <div
              key={card.headline}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8"
            >
              <div className="text-3xl md:text-4xl font-bold leading-tight text-mint">
                {card.headline}
              </div>
              <p className="mt-2 text-sm md:text-base font-semibold text-starwhite leading-snug">
                {card.label}
              </p>
              <p className="mt-4 text-sm md:text-base text-white/60 leading-relaxed">{card.body}</p>

              {card.citations && (
                <p className="mt-auto pt-5 text-[11px] leading-snug text-white/35">
                  <span className="block border-t border-white/10 pt-4">
                    {card.citations.map((c, i) => (
                      <span key={c.href}>
                        {i > 0 && <span className="px-1.5">·</span>}
                        <a
                          href={c.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-white/20 decoration-dotted underline-offset-2 hover:text-mint hover:decoration-mint/50 transition-colors"
                        >
                          {c.citation}
                        </a>
                      </span>
                    ))}
                  </span>
                </p>
              )}

              {!card.citations && card.note && (
                <p className="mt-auto pt-5 text-[11px] leading-snug text-white/35">
                  <span className="block border-t border-white/10 pt-4">{card.note}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
