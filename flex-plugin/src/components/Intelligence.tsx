import React from 'react'
import type { CubeSmartIntelligence, CubeSmartNextBestAction } from '../context'
import { palette as c } from '../theme'
import { Pill, Section } from './primitives'

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const BANDS: Record<string, { label: string; fg: string; bar: string; tone: Tone }> = {
  low: { label: 'Low risk', fg: c.glow, bar: c.orange, tone: 'good' },
  watch: { label: 'Watch', fg: '#7dd3fc', bar: '#38bdf8', tone: 'neutral' },
  elevated: { label: 'Elevated risk', fg: c.amber, bar: c.amber, tone: 'warn' },
  high: { label: 'High risk', fg: c.red, bar: c.red, tone: 'bad' },
}

const SENTIMENTS: Record<string, { label: string; tone: Tone }> = {
  positive: { label: 'Positive', tone: 'good' },
  neutral: { label: 'Neutral', tone: 'neutral' },
  mixed: { label: 'Mixed', tone: 'warn' },
  negative: { label: 'Negative', tone: 'bad' },
}

export function hasIntelligence(intel?: CubeSmartIntelligence | null): boolean {
  if (!intel) return false
  return Boolean(
    intel.call_reason ||
      intel.sentiment ||
      intel.retention_risk_score !== null && intel.retention_risk_score !== undefined ||
      intel.next_best_action
  )
}

function Meter({ value, color }: { value: number; color: string }) {
  const pct = Math.max(2, Math.min(100, value))
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 999,
          background: color,
          transition: 'width 600ms ease',
        }}
      />
    </div>
  )
}

/**
 * The recommended save offer.
 *
 * Deliberately only ever shown to the human — the voice agent is not allowed to
 * make this offer itself, which is exactly why the handoff matters.
 */
export function NextBestActionCard({ nba }: { nba?: CubeSmartNextBestAction | null }) {
  if (!nba?.offer) return null

  return (
    <div
      style={{
        background: 'linear-gradient(150deg, rgba(255,122,26,0.16), rgba(194,87,10,0.08))',
        border: '1px solid rgba(255,165,82,0.45)',
        borderRadius: 12,
        padding: '12px 13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: c.glow,
          }}
        >
          Recommended next step
        </div>
        {nba.urgency ? <Pill label={nba.urgency} tone="good" /> : null}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text, marginBottom: 5 }}>
        {nba.headline || 'Save offer'}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: c.text }}>{nba.offer}</div>

      {nba.rationale ? (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: c.dim, marginTop: 7 }}>
          {nba.rationale}
        </div>
      ) : null}

      {nba.policy_source ? (
        <div
          style={{
            fontSize: 9.5,
            color: c.faint,
            marginTop: 8,
            paddingTop: 7,
            borderTop: '1px solid rgba(52,211,153,0.2)',
          }}
        >
          From the store playbook — {nba.policy_source}
        </div>
      ) : null}
    </div>
  )
}

/** Call reason, sentiment and retention risk, as the operators score them live. */
export function IntelligenceBlock({ intel }: { intel?: CubeSmartIntelligence | null }) {
  if (!hasIntelligence(intel)) return null
  const i = intel!

  const band = BANDS[String(i.retention_risk_band ?? '').toLowerCase()]
  const score = i.retention_risk_score
  const drivers = i.retention_risk_drivers ?? []
  const sentiment = SENTIMENTS[String(i.sentiment ?? '').toLowerCase()]
  const trail = i.sentiment_trail ?? []

  return (
    <Section title="Live call intelligence">
      <div
        style={{
          background: c.panel,
          border: `1px solid ${c.line}`,
          borderRadius: 11,
          padding: '11px 12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {i.call_reason ? (
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: c.glow,
                background: 'rgba(255,165,82,0.12)',
                border: '1px solid rgba(255,165,82,0.3)',
                borderRadius: 8,
                padding: '4px 9px',
              }}
            >
              {i.call_reason}
            </span>
          ) : null}
          {sentiment ? <Pill label={sentiment.label} tone={sentiment.tone} /> : null}
          {i.call_reason_confidence ? (
            <span style={{ fontSize: 9.5, color: c.faint }}>
              {i.call_reason_confidence}% confident
            </span>
          ) : null}
        </div>

        {i.call_reason_evidence ? (
          <div
            style={{
              fontSize: 11,
              fontStyle: 'italic',
              color: c.dim,
              marginTop: 7,
              paddingLeft: 8,
              borderLeft: `2px solid ${c.line}`,
              lineHeight: 1.5,
            }}
          >
            &ldquo;{i.call_reason_evidence}&rdquo;
          </div>
        ) : null}

        {trail.length > 1 ? (
          <div style={{ fontSize: 9.5, color: c.faint, marginTop: 7 }}>
            Sentiment through the call: {trail.join(' → ')}
          </div>
        ) : null}

        {band && (score || score === 0) ? (
          <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${c.line}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: band.fg }}>
                {score}
              </span>
              <span style={{ fontSize: 10, color: c.faint }}>/ 100</span>
              <Pill
                label={band.label + (i.retention_risk_trend === 'rising' ? ' · rising' : '')}
                tone={band.tone}
              />
            </div>

            <Meter value={Number(score)} color={band.bar} />

            {drivers.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
                {drivers.map((d, n) => (
                  <span
                    key={`dr${n}`}
                    style={{
                      fontSize: 10.5,
                      color: c.dim,
                      background: c.soft,
                      border: `1px solid ${c.line}`,
                      borderRadius: 999,
                      padding: '3px 8px',
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : null}

            {i.retention_risk_quote ? (
              <div
                style={{
                  fontSize: 11,
                  fontStyle: 'italic',
                  color: c.dim,
                  marginTop: 8,
                  paddingLeft: 8,
                  borderLeft: `2px solid ${c.line}`,
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{i.retention_risk_quote}&rdquo;
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ fontSize: 9, color: c.faint, marginTop: 10 }}>
          Twilio Language Operators, scored live on this call
          {i.last_latency_ms ? ` · last read ${(Number(i.last_latency_ms) / 1000).toFixed(1)}s` : ''}
        </div>
      </div>
    </Section>
  )
}
