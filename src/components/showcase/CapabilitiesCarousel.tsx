'use client'

import { useEffect, useRef, useState } from 'react'
import type { Capability } from '@/lib/data/capabilities'
import { PhoneFrame } from './PhoneFrame'

/** Every phone mockup sits in an identically sized device frame so the row reads as one shelf. */
const FRAME =
  'relative w-[240px] h-[490px] rounded-[2.25rem] bg-ink border-[6px] border-black/40 shadow-2xl shadow-black/50 overflow-hidden shrink-0 mx-auto'

/**
 * The desktop mockup is rendered from a larger source GIF (970×800) so the UI inside it stays
 * legible: 588px tall (20% taller than the phone shelf) which, at its natural aspect ratio,
 * makes it ~713px wide — 50% wider than the previous 776×800 render.
 */
const WIDE_FRAME =
  'relative h-[380px] sm:h-[480px] md:h-[588px] max-w-full rounded-2xl bg-ink border-[6px] border-black/40 shadow-2xl shadow-black/50 overflow-hidden'

function Caption({ cap }: { cap: Capability }) {
  return (
    <div className="mt-5 text-center max-w-[260px]">
      <span
        className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full mb-2"
        style={{ background: `${cap.accent}22`, color: cap.accent }}
      >
        {cap.product}
      </span>
      <h3 className="text-base font-semibold text-starwhite">{cap.title}</h3>
      <p className="mt-1.5 text-xs text-white/50 leading-relaxed">{cap.description}</p>
    </div>
  )
}

/**
 * Cards that carry both a still and an animation start still — the row would be far too busy
 * with four animations running at once — and swap to the animation on click. The mint glow ring
 * plus the play badge are what tell you it's clickable.
 */
function PlayableCapability({ cap }: { cap: Capability }) {
  const [playing, setPlaying] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      aria-label={playing ? `Pause the ${cap.title} animation` : `Play the ${cap.title} animation`}
      className={`${FRAME} block cursor-pointer transition ${playing ? '' : 'mint-glow-ring'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playing ? cap.imageUrl : cap.posterUrl}
        alt={cap.title}
        className="absolute inset-0 w-full h-full object-contain bg-ink"
      />

      {!playing && (
        <>
          <span className="absolute inset-0 bg-black/25" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/90 text-ink shadow-lg shadow-mint/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          <span className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-semibold uppercase tracking-wide text-starwhite/90">
            Tap to play
          </span>
        </>
      )}
    </button>
  )
}

function PhoneCapability({ cap }: { cap: Capability }) {
  return (
    <div className="w-[260px] flex flex-col items-center">
      {cap.posterUrl && cap.imageUrl ? (
        <PlayableCapability cap={cap} />
      ) : cap.videoUrl ? (
        <div className={FRAME}>
          <video
            src={cap.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      ) : cap.imageUrl ? (
        <div className={FRAME}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cap.imageUrl}
            alt={cap.title}
            className="absolute inset-0 w-full h-full object-contain bg-ink"
          />
        </div>
      ) : cap.videoEmbedUrl ? (
        <div className={FRAME}>
          <iframe
            src={cap.videoEmbedUrl}
            title={cap.title}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full pointer-events-none"
            tabIndex={-1}
          />
          {/* Transparent shield keeps the embed fully non-interactive so YouTube's
              hover/pause title + channel avatar overlay never has a chance to appear. */}
          <div className="absolute inset-0 z-10" />
        </div>
      ) : (
        <PhoneFrame accent={cap.accent} messages={cap.messages} callScreen={cap.callScreen} rcs={cap.rcs} />
      )}
      <Caption cap={cap} />
    </div>
  )
}

function DesktopCapability({ cap }: { cap: Capability }) {
  return (
    <div className="flex flex-col items-center">
      <div className={WIDE_FRAME}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cap.imageUrl} alt={cap.title} className="h-full w-auto max-w-full object-contain block bg-ink" />
      </div>
      <Caption cap={cap} />
    </div>
  )
}

function Arrow({
  side,
  onClick,
  label,
  disabled,
  nudge,
}: {
  side: 'left' | 'right'
  onClick: () => void
  label: string
  disabled: boolean
  nudge?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`grid h-10 w-10 place-items-center rounded-full border transition ${
        disabled
          ? 'border-white/10 bg-white/5 text-white/25 cursor-default'
          : 'border-white/15 bg-white/10 text-starwhite hover:bg-white/20'
      } ${nudge ? 'nudge-halo' : ''}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={nudge ? 'nudge-right' : ''}
      >
        {side === 'left' ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  )
}

/** Horizontal twin of the page's dot rail: arrow — beads — arrow, centred above the panels. */
function ViewSwitcher({
  showDesktop,
  onSelect,
  nudge,
}: {
  showDesktop: boolean
  onSelect: (desktop: boolean) => void
  nudge: boolean
}) {
  const views: { desktop: boolean; label: string }[] = [
    { desktop: false, label: 'Member channels' },
    { desktop: true, label: 'Staff desktop view' },
  ]

  return (
    <div className="flex items-center justify-center gap-4">
      <Arrow
        side="left"
        label="Back to member channels"
        disabled={!showDesktop}
        onClick={() => onSelect(false)}
      />

      <div className="flex items-center gap-2.5">
        {views.map((view) => {
          const active = view.desktop === showDesktop
          return (
            <button
              key={view.label}
              type="button"
              onClick={() => onSelect(view.desktop)}
              aria-label={view.label}
              className={`rounded-full transition-all ${
                active ? 'w-3 h-3 bg-mint' : 'w-2 h-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          )
        })}
      </div>

      <Arrow
        side="right"
        label="See the staff desktop view"
        disabled={showDesktop}
        nudge={nudge}
        onClick={() => onSelect(true)}
      />
    </div>
  )
}

export function CapabilitiesCarousel({
  phones,
  desktop,
}: {
  phones: Capability[]
  desktop?: Capability
}) {
  const [showDesktop, setShowDesktop] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)

  // Play the nudge whenever the section scrolls into view, until the visitor uses the control.
  useEffect(() => {
    const node = stageRef.current
    if (!node || interacted) return
    const observer = new IntersectionObserver(
      ([entry]) => setNudge(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 0.75] },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [interacted])

  const select = (wantDesktop: boolean) => {
    setInteracted(true)
    setNudge(false)
    setShowDesktop(wantDesktop)
  }

  return (
    <div ref={stageRef} className="mx-auto w-[1240px] max-w-full px-6 md:px-8">
      {desktop && (
        <div className="mb-8">
          <ViewSwitcher showDesktop={showDesktop} onSelect={select} nudge={nudge && !showDesktop} />
        </div>
      )}

      {showDesktop && desktop ? (
        <div className="flex justify-center">
          <DesktopCapability cap={desktop} />
        </div>
      ) : (
        <div className="flex items-start justify-center gap-4 md:gap-6 flex-wrap lg:flex-nowrap">
          {phones.map((cap) => (
            <PhoneCapability key={cap.id} cap={cap} />
          ))}
        </div>
      )}
    </div>
  )
}
