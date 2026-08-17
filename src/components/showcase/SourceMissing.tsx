export function SourceMissing() {
  return (
    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-xplorange whitespace-nowrap align-middle">
      [source missing]
    </span>
  )
}

/** Heuristic: flag a bullet/stat as a quantified claim if it contains a %, $, or an "Nx" multiplier. */
export function hasMetric(text: string): boolean {
  return /[$%]|\d+(\.\d+)?x\b/i.test(text)
}
