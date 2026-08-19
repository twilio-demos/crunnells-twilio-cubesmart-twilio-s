export function CubeSmartLogoMark({ size = 24 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://rosewood-clam-5211.twil.io/assets/cubesmart_logo.png"
      alt="CubeSmart"
      className="object-contain shrink-0"
      style={{ height: size, width: "auto" }}
    />
  )
}

// Kept as an alias so any future search for the old name still finds this file.
export const BarrysLogoMark = CubeSmartLogoMark
