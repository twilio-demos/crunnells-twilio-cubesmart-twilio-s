export function CubeSmartLogoMark({ size = 24 }: { size?: number }) {
  return (
    <div
      className="rounded-[22%] bg-black flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* A stack of storage cubes — the CubeSmart mark for this demo's device chrome. */}
        <rect x="3" y="13" width="8" height="8" rx="1" stroke="#ff7a1a" strokeWidth="2" />
        <rect x="13" y="13" width="8" height="8" rx="1" stroke="white" strokeWidth="2" />
        <rect x="8" y="3" width="8" height="8" rx="1" fill="#ff7a1a" />
      </svg>
    </div>
  )
}

// Kept as an alias so any future search for the old name still finds this file.
export const BarrysLogoMark = CubeSmartLogoMark
