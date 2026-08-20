export function HeroSection() {
  return (
    <section
      id="perspective"
      className="min-h-screen snap-start flex flex-col justify-center px-6 md:px-16 py-24 relative overflow-hidden"
    >
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-neptune/20 blur-3xl" />
      <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-mint/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">CubeSmart</span>
          <span className="text-white/30">×</span>
          <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">Twilio</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-semibold leading-[1.05] max-w-4xl animate-fade-up">
          The communications platform layer inside the
          <span className="text-mint"> CubeSmart Management Platform — from booking a unit to move-in day.</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
          The CubeSmart Management Platform gives CubeSmart&apos;s 1,516 stores the modernized system of record to run the business.
          Twilio gives the CubeSmart Management Platform the embedded voice, messaging, verification, and AI layer that turns every
          tenant touchpoint — leasing, move-in, billing, and retention — into a moment that matters.
        </p>
      </div>
    </section>
  )
}
