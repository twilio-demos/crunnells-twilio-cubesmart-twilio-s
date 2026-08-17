'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { streams, flexShortcut, type Stream, type StreamStage, type StreamId, type ValueBullet } from '@/lib/data/maturity'
import { SourceMissing, hasMetric } from './SourceMissing'

/** Key format: `${streamId}--${stageId}` for a stream stage. */
function keyFor(streamId: StreamId, stageId: string) {
  return `${streamId}--${stageId}`
}

interface DetailData {
  key: string
  icon: string
  name: string
  tagline: string
  description: string
  techStack: string[]
  useCases: { title: string; description: string }[]
  studioValue: ValueBullet[]
  bmsValue: ValueBullet[]
  color: string
  streamId: StreamId
  stageId: string
  stageIndex: number
  streamLength: number
  streamName: string
}

interface Point {
  x: number
  y: number
}

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface PerimeterGeometry {
  path: string
  flexLine: Line
}

/** Draws a multi-segment path through the given waypoints with gently rounded corners at
 *  every interior point, instead of hard right angles. If the first and last waypoint are the
 *  same point, the resulting path reads as a closed loop once `Z` is appended. */
function roundedPolyline(rawPoints: Point[], radius = 20) {
  const points: Point[] = []
  rawPoints.forEach((p) => {
    const last = points[points.length - 1]
    if (!last || Math.abs(last.x - p.x) > 1 || Math.abs(last.y - p.y) > 1) points.push(p)
  })
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const prev = points[i - 1]
    const next = points[i + 1]
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y)
    const outLen = Math.hypot(next.x - p.x, next.y - p.y)
    if (inLen < 1 || outLen < 1) continue
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const inU = { x: (p.x - prev.x) / inLen, y: (p.y - prev.y) / inLen }
    const outU = { x: (next.x - p.x) / outLen, y: (next.y - p.y) / outLen }
    d += ` L ${p.x - inU.x * r} ${p.y - inU.y * r}`
    d += ` Q ${p.x} ${p.y} ${p.x + outU.x * r} ${p.y + outU.y * r}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function ValueList({ items, color }: { items: ValueBullet[]; color: string }) {
  return (
    <ul className="space-y-3 text-base text-white/80">
      {items.map((item) => {
        const text = typeof item === 'string' ? item : item.text
        const sourced = typeof item !== 'string' && item.sourced
        const citation = typeof item !== 'string' ? item.citation : undefined
        const href = typeof item !== 'string' ? item.href : undefined
        const citations = typeof item !== 'string' ? item.citations : undefined
        return (
          <li key={text} className="flex gap-3">
            <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="leading-relaxed block">
              {text}
              {!sourced && hasMetric(text) && <SourceMissing />}
              {citations && citations.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {citations.map((c) => (
                    <a
                      key={c.href}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-white/35 underline decoration-white/20 decoration-dotted underline-offset-2 transition-colors hover:text-mint hover:decoration-mint/50"
                    >
                      {c.citation}
                    </a>
                  ))}
                </span>
              )}
              {!citations && citation && href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-[11px] text-white/35 underline decoration-white/20 decoration-dotted underline-offset-2 transition-colors hover:text-mint hover:decoration-mint/50"
                >
                  {citation}
                </a>
              )}
              {!citations && citation && !href && (
                <span className="mt-1 block text-[11px] text-white/35">{citation}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function StepArrow() {
  return (
    <span aria-hidden className="hidden sm:block text-white/25 text-lg shrink-0 self-center">
      →
    </span>
  )
}

const PERIMETER_MARGIN = 16
const PERIMETER_MIN_VIEWPORT = 1024 // matches Tailwind's `lg` breakpoint

export function MaturitySection() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mode, setMode] = useState<'diy' | 'flex'>('diy')
  const [perimeter, setPerimeter] = useState<PerimeterGeometry | null>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const flexCardRef = useRef<HTMLDivElement | null>(null)
  const omniTileRef = useRef<HTMLDivElement | null>(null)
  const voiceLaneRef = useRef<HTMLDivElement | null>(null)
  const aiLastTileRef = useRef<HTMLDivElement | null>(null)

  const streamById = useMemo(() => {
    const map = new Map<StreamId, Stream>()
    streams.forEach((s) => map.set(s.id, s))
    return map
  }, [])

  const messaging = streamById.get('messaging')!
  const voice = streamById.get('voice')!
  const ai = streamById.get('ai')!

  const tileTag = (streamId: StreamId, stageId: string): string | null => {
    if (streamId === 'messaging' && stageId === 'msg-alerts') return 'Start here'
    if (streamId === 'voice' && stageId === 'voice-outbound') return 'Start here'
    if (streamId === 'ai' && stageId === 'ai-messaging-hookup') return 'Day 1 ready'
    return null
  }

  const activeDetail: DetailData | null = useMemo(() => {
    if (!selectedKey) return null
    const [streamId, stageId] = selectedKey.split('--') as [StreamId, string]
    const stream = streamById.get(streamId)
    const stageIndex = stream?.stages.findIndex((s) => s.id === stageId) ?? -1
    const stage = stageIndex >= 0 ? stream?.stages[stageIndex] : undefined
    if (!stream || !stage) return null
    return {
      key: selectedKey,
      icon: stage.icon,
      name: stage.name,
      tagline: stage.tagline,
      description: stage.description,
      techStack: stage.techStack,
      useCases: stage.useCases,
      studioValue: stage.studioValue,
      bmsValue: stage.bmsValue,
      color: stream.color,
      streamId,
      stageId,
      stageIndex,
      streamLength: stream.stages.length,
      streamName: stream.name,
    }
  }, [selectedKey, streamById])

  useEffect(() => {
    if (!selectedKey) return
    const t = setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(t)
  }, [selectedKey])

  // Deep-linkable: on first load, jump straight to a stage if the URL hash requests one. Flex SDK
  // mode is deliberately NOT restored from the hash — the section always opens on DIY.
  useEffect(() => {
    const match = window.location.hash.match(/^#maturity-(.+)$/)
    if (!match) return
    if (match[1] === 'flex') {
      window.history.replaceState(null, '', '#maturity')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedKey(match[1])
  }, [])

  useEffect(() => {
    if (selectedKey) {
      window.history.replaceState(null, '', `#maturity-${selectedKey}`)
    } else if (window.location.hash.startsWith('#maturity-')) {
      window.history.replaceState(null, '', '#maturity')
    }
  }, [selectedKey])

  // The perimeter that illustrates "what Flex SDK includes" — one continuous outline enveloping
  // Omnichannel Conversations, the whole Voice Stream (label included, so the boundary clears the
  // "VOICE STREAM" text), and Unified Omnichannel Agent, joined by narrow bridges rather than
  // separate boxes-with-wires, plus one single straight line from the center of the Voice Stream
  // envelope out to the Flex SDK card. Only drawn on larger screens and only while Flex SDK mode
  // is on. Uses a ResizeObserver on the surface element (not just a window `resize` listener) so
  // it stays accurate through flex-wrap reflows at any width, and a requestAnimationFrame so
  // every read happens after layout has actually settled.
  useEffect(() => {
    if (mode !== 'flex') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPerimeter(null)
      return
    }

    let frame = 0

    const update = () => {
      if (window.innerWidth < PERIMETER_MIN_VIEWPORT) {
        setPerimeter(null)
        return
      }
      const surfaceEl = surfaceRef.current
      const flexEl = flexCardRef.current
      const omniEl = omniTileRef.current
      const voiceEl = voiceLaneRef.current
      const aiEl = aiLastTileRef.current
      if (!surfaceEl || !flexEl || !omniEl || !voiceEl || !aiEl) {
        setPerimeter(null)
        return
      }

      const origin = surfaceEl.getBoundingClientRect()
      const rel = (r: DOMRect) => ({
        left: r.left - origin.left,
        right: r.right - origin.left,
        top: r.top - origin.top,
        bottom: r.bottom - origin.top,
      })
      const flex = rel(flexEl.getBoundingClientRect())
      const omni = rel(omniEl.getBoundingClientRect())
      const voiceLane = rel(voiceEl.getBoundingClientRect())
      const aiTile = rel(aiEl.getBoundingClientRect())
      const m = PERIMETER_MARGIN

      // O = omni tile box, V = whole Voice lane box (label + tiles), A = ai-unified tile box.
      // All three right edges are forced to the SAME x so the right-hand side of the outline is
      // one perfectly straight line, regardless of sub-pixel differences between the three
      // measured elements.
      const rawO = { x1: omni.left - m, x2: omni.right + m, y1: omni.top - m, y2: omni.bottom + m }
      const rawV = { x1: voiceLane.left - m, x2: voiceLane.right + m, y1: voiceLane.top - m, y2: voiceLane.bottom + m }
      const rawA = { x1: aiTile.left - m, x2: aiTile.right + m, y1: aiTile.top - m, y2: aiTile.bottom + m }
      const rightX = Math.max(rawO.x2, rawV.x2, rawA.x2)
      const O = { ...rawO, x2: rightX }
      const V = { ...rawV, x2: rightX }
      const A = { ...rawA, x2: rightX }

      // One continuous, non-self-intersecting outline. Starts and ends at the MIDPOINT of
      // Voice's left edge (a straight run, not a corner) rather than at Voice's top-left corner
      // — the rounding helper never rounds the first/last waypoint of the array, so starting on
      // an actual corner left it sharp while every other corner rounded. Starting mid-edge means
      // every real corner (including Voice's top-left) is now an interior point and rounds evenly.
      const leftMidY = (V.y1 + V.y2) / 2
      const points: Point[] = [
        { x: V.x1, y: leftMidY },
        { x: V.x1, y: V.y1 },
        { x: O.x1, y: V.y1 },
        { x: O.x1, y: O.y2 },
        { x: O.x1, y: O.y1 },
        { x: O.x2, y: O.y1 },
        { x: O.x2, y: O.y2 },
        { x: O.x2, y: V.y1 },
        { x: V.x2, y: V.y1 },
        { x: V.x2, y: V.y2 },
        { x: A.x2, y: V.y2 },
        { x: A.x2, y: A.y1 },
        { x: A.x2, y: A.y2 },
        { x: A.x1, y: A.y2 },
        { x: A.x1, y: A.y1 },
        { x: A.x1, y: V.y2 },
        { x: V.x1, y: V.y2 },
        { x: V.x1, y: leftMidY },
      ]

      const voiceCenterY = (V.y1 + V.y2) / 2

      setPerimeter({
        path: `${roundedPolyline(points)} Z`,
        flexLine: { x1: V.x2, y1: voiceCenterY, x2: flex.left, y2: voiceCenterY },
      })
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    scheduleUpdate()

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    if (surfaceRef.current) resizeObserver.observe(surfaceRef.current)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [mode])

  const toggle = (key: string) => setSelectedKey((cur) => (cur === key ? null : key))

  const goPrevNext = (dir: -1 | 1) => {
    if (!activeDetail) return
    const stream = streamById.get(activeDetail.streamId)
    const nextIndex = activeDetail.stageIndex + dir
    const target = stream?.stages[nextIndex]
    if (target) setSelectedKey(keyFor(activeDetail.streamId, target.id))
  }

  const renderTile = (stream: Stream, stage: StreamStage, index: number) => {
    const key = keyFor(stream.id, stage.id)
    const isSelected = key === selectedKey
    const tag = tileTag(stream.id, stage.id)
    const isOmniTile = stream.id === 'messaging' && stage.id === 'msg-omnichannel-conversations'
    const isAiLastTile = stream.id === 'ai' && stage.id === 'ai-unified'
    return (
      <div
        key={stage.id}
        ref={(el) => {
          if (isOmniTile) omniTileRef.current = el
          if (isAiLastTile) aiLastTileRef.current = el
        }}
        role="button"
        tabIndex={0}
        onClick={() => toggle(key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle(key)
          }
        }}
        title={stage.name}
        className={`select-none cursor-pointer shrink-0 w-40 rounded-xl border p-3 transition-all relative ${
          isSelected
            ? 'border-mint bg-white/10 ring-2 ring-mint/40 perimeter-glow'
            : `border-white/10 bg-white/5 hover:border-white/25 hover:-translate-y-0.5 ${!activeDetail ? 'idle-glow' : ''}`
        }`}
      >
        {tag && (
          <span className="absolute -top-2 -left-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-starwhite text-ink shadow-sm whitespace-nowrap">
            {tag}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 shrink-0"
            style={{
              borderColor: stream.color,
              background: isSelected ? stream.color : 'transparent',
              color: isSelected ? '#0a0a0a' : stream.color,
            }}
          >
            {index + 1}
          </span>
          <span className="text-base">{stage.icon}</span>
        </div>

        <h3 className="mt-2 text-xs font-semibold text-starwhite leading-snug">{stage.name}</h3>
        <p className="mt-0.5 text-[10px] text-white/45 leading-snug">{stage.tagline}</p>
      </div>
    )
  }

  const renderLane = (stream: Stream) => (
    <div key={stream.id} ref={stream.id === 'voice' ? voiceLaneRef : undefined}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stream.color }} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: stream.color }}>
          {stream.name}
        </h3>
        <span className="text-white/35 text-xs">— {stream.description}</span>
      </div>
      <div
        className={`flex flex-wrap items-stretch gap-3 md:gap-4 ${mode === 'flex' ? 'justify-start' : 'justify-center'}`}
      >
        {stream.stages.map((stage, i) => (
          <div key={stage.id} className="flex items-stretch gap-3 md:gap-4">
            {i > 0 && <StepArrow />}
            {renderTile(stream, stage, i)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <section id="maturity" className="relative min-h-screen snap-start flex flex-col justify-center py-24">
      <div className="max-w-6xl mx-auto w-full px-6 md:px-16">
        <span className="text-xs uppercase tracking-[0.2em] text-mint font-semibold">The Framework</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight max-w-3xl">
          CubeSmart
          <br />
          AI-Native Communications
          <br />
          Adoption Arch
        </h2>
        <p className="mt-5 text-white/60 max-w-2xl text-base md:text-lg">
          Three independent streams mature side by side — Messaging, Voice, and AI — each one useful
          on its own, with no single required order between them. A text-based AI agent can go live
          on day one, right alongside the simplest outbound call. The Flex SDK is an accelerator, not a
          fourth stream: it embeds native omnichannel controls directly into the CubeSmart
          Management Platform in one integration.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] text-white/40">
          <div className="ml-auto inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] p-1">
            <button
              onClick={() => setMode('diy')}
              aria-pressed={mode === 'diy'}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                mode === 'diy' ? 'bg-white/12 text-starwhite' : 'text-white/45 hover:text-white/70'
              }`}
            >
              DIY
            </button>
            <button
              onClick={() => setMode('flex')}
              aria-pressed={mode === 'flex'}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                mode === 'flex' ? 'bg-sunray/20 text-sunray' : 'text-white/45 hover:text-white/70'
              }`}
            >
              ⚡ Flex SDK
            </button>
          </div>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className={`relative mt-10 mx-auto w-full px-6 md:px-16 ${mode === 'flex' ? 'max-w-[100rem]' : 'max-w-6xl'}`}
      >
        {perimeter && (
          <svg className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden>
            <g className="sunray-perimeter-glow" stroke="#ecfd91" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d={perimeter.path} fill="rgba(236, 253, 145, 0.03)" />
              <line x1={perimeter.flexLine.x1} y1={perimeter.flexLine.y1} x2={perimeter.flexLine.x2} y2={perimeter.flexLine.y2} />
            </g>
          </svg>
        )}

        <div className="relative flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          <div className="flex-1 min-w-0 space-y-16">
            {renderLane(messaging)}
            {renderLane(voice)}
            {renderLane(ai)}
          </div>

          {mode === 'flex' && (
            <div className="w-full lg:w-[600px] shrink-0">
              <div
                ref={flexCardRef}
                className="relative rounded-3xl border-2 border-sunray bg-sunray/10 ring-2 ring-sunray/30 shortcut-glow p-6 md:p-8 animate-fade-up"
              >
                <button
                  onClick={() => setMode('diy')}
                  aria-label="Close and switch back to DIY"
                  className="absolute top-5 right-5 text-white/30 hover:text-white/80 text-sm transition-colors"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-2xl">{flexShortcut.icon}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-sunray/20 text-sunray">
                    ⚡ The Accelerator
                  </span>
                </div>

                <h3 className="text-2xl font-semibold text-starwhite">{flexShortcut.name}</h3>
                <p className="mt-3 text-white/70 text-sm leading-relaxed">{flexShortcut.description}</p>

                <div className="mt-6">
                  <p className="text-xs uppercase tracking-wide text-white/40 mb-3">Use cases in action</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {flexShortcut.useCases.map((uc, i) => (
                      <div key={uc.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] font-bold text-sunray mb-1">{String(i + 1).padStart(2, '0')}</p>
                        <h4 className="text-sm font-semibold text-starwhite leading-snug">{uc.title}</h4>
                        <p className="mt-1 text-xs text-white/55 leading-relaxed">{uc.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-barrys font-semibold mb-2">Value for the Store</p>
                    <ValueList items={flexShortcut.studioValue} color="var(--barrys)" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neptune-hover font-semibold mb-2">Value for CubeSmart&apos;s Management Platform</p>
                    <ValueList items={flexShortcut.bmsValue} color="var(--neptune-hover)" />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/10">
                  <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Twilio Building Blocks</p>
                  <div className="flex flex-wrap gap-2">
                    {flexShortcut.techStack.map((p) => (
                      <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-white/15 text-white/70">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {!activeDetail && (
          <p className="mt-10 text-center text-sm text-white/35 animate-fade-up">
            ↑ Click any stage to see its full breakdown
          </p>
        )}
      </div>

      <div className="max-w-6xl mx-auto w-full px-6 md:px-16">
        {activeDetail && (
          <div
            ref={detailsRef}
            key={activeDetail.key}
            className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 animate-fade-up relative perimeter-glow"
          >
            <button
              onClick={() => setSelectedKey(null)}
              aria-label="Close details"
              className="absolute top-5 right-5 text-white/30 hover:text-white/80 text-sm transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-2xl">{activeDetail.icon}</span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                style={{ background: `${activeDetail.color}22`, color: activeDetail.color }}
              >
                {activeDetail.streamName} · Stage {activeDetail.stageIndex + 1} of {activeDetail.streamLength} ·{' '}
                {activeDetail.tagline}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mb-5">
              {streamById.get(activeDetail.streamId)!.stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedKey(keyFor(activeDetail.streamId, s.id))}
                  aria-label={`Go to ${s.name}`}
                  className="p-1 -m-1"
                >
                  <span
                    className="block rounded-full transition-all"
                    style={{
                      width: s.id === activeDetail.stageId ? 18 : 6,
                      height: 6,
                      background: s.id === activeDetail.stageId ? activeDetail.color : 'rgba(255,255,255,0.15)',
                    }}
                  />
                </button>
              ))}
            </div>

            <h3 className="text-2xl font-semibold text-starwhite">{activeDetail.name}</h3>
            <p className="mt-3 text-white/70 text-sm md:text-base leading-relaxed max-w-3xl">{activeDetail.description}</p>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-wide text-white/40 mb-4">Use cases in action</p>
              <div className="grid md:grid-cols-2 gap-4">
                {activeDetail.useCases.map((uc, i) => (
                  <div
                    key={uc.title}
                    className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 pl-6 overflow-hidden transition-all hover:-translate-y-0.5 hover:border-white/25"
                    style={{ borderLeftColor: activeDetail.color, borderLeftWidth: '3px' }}
                  >
                    <div
                      className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity"
                      style={{ background: activeDetail.color }}
                    />
                    <div className="relative flex items-start gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${activeDetail.color}22`, color: activeDetail.color }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-starwhite leading-snug">{uc.title}</h4>
                        <p className="mt-1.5 text-xs text-white/55 leading-relaxed">{uc.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-barrys font-semibold mb-3">Value for the Store (Property Level)</p>
                <ValueList items={activeDetail.studioValue} color="var(--barrys)" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neptune-hover font-semibold mb-3">Value for CubeSmart&apos;s Management Platform</p>
                <ValueList items={activeDetail.bmsValue} color="var(--neptune-hover)" />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs uppercase tracking-wide text-white/40 mb-3">Twilio Building Blocks</p>
              <div className="flex flex-wrap gap-2">
                {activeDetail.techStack.map((p) => (
                  <span key={p} className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/70">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => goPrevNext(-1)}
                disabled={activeDetail.stageIndex <= 0}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-starwhite transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                ← <span className="hidden sm:inline">Previous in {activeDetail.streamName}</span>
              </button>
              <button
                onClick={() => goPrevNext(1)}
                disabled={activeDetail.stageIndex >= activeDetail.streamLength - 1}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-starwhite transition-colors text-right disabled:opacity-0 disabled:pointer-events-none"
              >
                <span className="hidden sm:inline">Next in {activeDetail.streamName}</span> →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
