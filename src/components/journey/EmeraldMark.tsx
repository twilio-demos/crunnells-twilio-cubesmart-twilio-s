export function CubeSmartMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-emerald-ink ring-1 ring-emerald/40"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.66}
        height={size * 0.66}
        fill="none"
        stroke="currentColor"
        className="text-emerald-glow"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stacked storage cubes — the CubeSmart mark for the guided move-in journey. */}
        <rect x="3" y="12" width="8" height="8" rx="1" />
        <rect x="13" y="12" width="8" height="8" rx="1" />
        <rect x="8" y="3" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

export function CubeSmartWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <CubeSmartMark size={34} />
      <div className="leading-tight">
        <div className="font-heading text-sm font-semibold tracking-tight text-starwhite">
          CubeSmart
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-glow/70">
          {subtitle ?? 'West 7th · Fort Worth'}
        </div>
      </div>
    </div>
  )
}

// Kept as aliases so any old import path still resolves to the CubeSmart mark.
export const EmeraldMark = CubeSmartMark
export const EmeraldWordmark = CubeSmartWordmark
