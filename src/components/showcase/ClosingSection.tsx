const nextSteps = [
  {
    title: 'Technical Deep Dives',
    description:
      'Working sessions on the products in this deck, run by Twilio solutions engineers. CubeSmart self-selects by stream — Messaging, Voice, or AI.',
  },
  {
    title: 'POC Scoping Session',
    description:
      "Led by Twilio Enterprise Strategy with CubeSmart's Management Platform architecture and product leads. Output is a written scope: target use case, success criteria, participants, and dates.",
  },
  {
    title: 'Onsite Hackathon',
    description:
      'Multi-day, led by Twilio Solution Acceleration Architects — forward-deployed engineers who build alongside your team. Runs against the scope agreed in the previous session, with a working prototype as the deliverable.',
  },
]

export function ClosingSection() {
  return (
    <section id="closing" className="min-h-screen snap-start flex flex-col justify-center items-center text-center px-6 md:px-16 py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-neptune/15 blur-3xl" />

      <div className="relative max-w-5xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">CubeSmart</span>
          <span className="text-white/30">×</span>
          <span className="text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">Twilio</span>
        </div>

        <h2 className="text-3xl md:text-5xl font-semibold leading-tight max-w-3xl mx-auto">
          Let&apos;s build the AI-native communications layer inside the CubeSmart Management Platform.
        </h2>
        <p className="mt-6 text-white/60 text-base md:text-lg max-w-3xl mx-auto">
          Powered by Twilio, CubeSmart can unlock a genuinely magical tenant experience across the
          entire portfolio. By building centrally in the CubeSmart Management Platform and scaling across 1,516 stores, one
          unified engine delivers the same battle-tested voice, messaging, verification, and AI
          orchestration layer — hyper-tuned to self-storage leasing, move-in, and retention.
        </p>

        <div className="mt-14 grid gap-5 md:grid-cols-3 text-left">
          {nextSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:border-mint/40"
            >
              <h3 className="font-heading text-xl md:text-2xl font-bold leading-snug text-starwhite">
                {step.title}
              </h3>
              <p className="mt-3 text-sm text-white/60 leading-relaxed font-normal">{step.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-16 text-[11px] text-white/30">
          Built on Twilio Voice, Messaging, Verify, Conversations, Memory, Conversational Intelligence, and Agent Connect orchestration.
        </p>
      </div>
    </section>
  )
}
