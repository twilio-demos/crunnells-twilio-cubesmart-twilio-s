'use client'

import { useRef } from 'react'

export function HorizontalScrollRow({
  children,
  onScroll,
  containerRef,
  center = false,
  padClass = 'px-12 md:px-20',
  fadeClass = 'w-12 md:w-20',
}: {
  children: React.ReactNode
  onScroll?: () => void
  containerRef?: (el: HTMLDivElement | null) => void
  /** Centre the cards when the row is narrower than its container, without clipping when it isn't. */
  center?: boolean
  padClass?: string
  fadeClass?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el
    containerRef?.(el)
  }

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  }

  return (
    <div className="relative w-full overflow-hidden">
      {/* Fade width matches the scroll track's own edge padding below, so card content
          never sits underneath the fade/arrow overlay. */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 ${fadeClass} bg-gradient-to-r from-deepspace to-transparent z-10`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 ${fadeClass} bg-gradient-to-l from-deepspace to-transparent z-10`}
      />

      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 items-center justify-center text-white/80 backdrop-blur transition-colors"
      >
        ‹
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 items-center justify-center text-white/80 backdrop-blur transition-colors"
      >
        ›
      </button>

      <div
        ref={setRef}
        onScroll={onScroll}
        className={`flex gap-6 overflow-x-auto pb-4 no-scrollbar ${padClass} snap-x scroll-smooth ${
          center ? '[justify-content:safe_center]' : ''
        }`}
      >
        {children}
      </div>

      <p className="md:hidden text-center text-[10px] text-white/30 mt-1">← swipe to see more →</p>
    </div>
  )
}
