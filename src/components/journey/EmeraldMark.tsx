export function CubeSmartMark({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://rosewood-clam-5211.twil.io/assets/cubesmart_logo.png"
      alt="CubeSmart"
      className="object-contain shrink-0 rounded-[25%]"
      style={{ height: size, width: "auto" }}
    />
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
          {subtitle ?? 'West 7th · Denver'}
        </div>
      </div>
    </div>
  )
}

// Kept as aliases so any old import path still resolves to the CubeSmart mark.
export const EmeraldMark = CubeSmartMark
export const EmeraldWordmark = CubeSmartWordmark
