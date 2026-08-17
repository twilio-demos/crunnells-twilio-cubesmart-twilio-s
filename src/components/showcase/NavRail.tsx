'use client'

export interface NavSection {
  id: string
  label: string
}

export function NavRail({
  sections,
  activeId,
  onSelect,
}: {
  sections: NavSection[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <>
      {/* Desktop rail */}
      <nav className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-50 flex-col items-end gap-4">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className="group flex items-center gap-3"
            >
              <span
                className={`text-xs font-medium whitespace-nowrap transition-all ${
                  active ? 'text-starwhite opacity-100 translate-x-0' : 'text-white/40 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                }`}
              >
                {section.label}
              </span>
              <span
                className={`block rounded-full transition-all ${
                  active ? 'w-3 h-3 bg-mint' : 'w-2 h-2 bg-white/30 group-hover:bg-white/60'
                }`}
              />
            </button>
          )
        })}
      </nav>

      {/* Mobile bottom pill nav */}
      <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-deepspace-light/90 backdrop-blur px-3 py-2 rounded-full border border-white/10 max-w-[92vw] overflow-x-auto no-scrollbar">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={`shrink-0 w-2.5 h-2.5 rounded-full transition-colors ${active ? 'bg-mint' : 'bg-white/30'}`}
              aria-label={section.label}
            />
          )
        })}
      </nav>
    </>
  )
}
