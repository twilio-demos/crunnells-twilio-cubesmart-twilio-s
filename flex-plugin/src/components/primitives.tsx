import React from 'react'
import { palette as c } from '../theme'

export function CubeSmartMark({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://rosewood-clam-5211.twil.io/assets/cubesmart_logo.png"
      alt="CubeSmart"
      style={{
        height: size,
        width: 'auto',
        flexShrink: 0,
        objectFit: 'contain',
        borderRadius: '25%',
      }}
    />
  )
}

// Kept as an alias so the old import name still resolves.
export const EmeraldMark = CubeSmartMark

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const toneMap: Record<Tone, { fg: string; bg: string; bd: string }> = {
  good: { fg: c.glow, bg: 'rgba(255,165,82,0.14)', bd: 'rgba(255,165,82,0.4)' },
  warn: { fg: c.amber, bg: c.amberBg, bd: c.amberLine },
  bad: { fg: c.red, bg: c.redBg, bd: c.redLine },
  neutral: { fg: c.dim, bg: c.soft, bd: c.line },
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = toneMap[tone]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function Field({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  const color = tone === 'bad' ? c.red : tone === 'warn' ? c.amber : tone === 'good' ? c.glow : c.text
  return (
    <div
      style={{
        background: c.soft,
        border: `1px solid ${c.line}`,
        borderRadius: 8,
        padding: '7px 9px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: c.faint,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color, wordBreak: 'break-word', lineHeight: 1.35 }}>
        {value || '—'}
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: c.faint,
          marginBottom: 7,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
      {children}
    </div>
  )
}

export function Callout({
  title,
  tone = 'warn',
  children,
}: {
  title: string
  tone?: 'warn' | 'bad'
  children: React.ReactNode
}) {
  const t = tone === 'bad' ? { bg: c.redBg, bd: c.redLine, fg: c.red } : { bg: c.amberBg, bd: c.amberLine, fg: c.amber }
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 10, padding: '10px 12px' }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: t.fg,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}
