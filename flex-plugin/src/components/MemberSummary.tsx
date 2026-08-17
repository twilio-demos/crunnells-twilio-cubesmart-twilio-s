import React from 'react'
import { withTaskContext, ITask } from '@twilio/flex-ui'
import { hasEmeraldContext, readAttributes } from '../context'
import { palette as c, font } from '../theme'
import { EmeraldMark, Pill } from './primitives'

/**
 * Compact version, added to the top of the task Info tab so the essentials are
 * visible even when the agent is not looking at the CRM panel.
 */
export function MemberSummaryBase({ task }: { task?: ITask }) {
  if (!task) return null

  const a = readAttributes(task)
  if (!hasEmeraldContext(a)) return null

  const e = a.emerald ?? {}
  const i = a.intelligence ?? {}
  const onHold = e.membership_status === 'on-hold'
  const cardExpired = e.payment_status === 'expired'
  const band = String(i.retention_risk_band ?? '').toLowerCase()
  const bandLabel: Record<string, string> = {
    low: 'Low risk',
    watch: 'Watch',
    elevated: 'Elevated risk',
    high: 'High risk',
  }
  const bandTone: Record<string, 'good' | 'neutral' | 'warn' | 'bad'> = {
    low: 'good',
    watch: 'neutral',
    elevated: 'warn',
    high: 'bad',
  }

  return (
    <div style={{ fontFamily: font, padding: '10px 12px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <EmeraldMark size={16} />
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: c.emerald,
          }}
        >
          Emerald Fitness
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        <Pill label={e.membership_tier ?? 'Member'} />
        <Pill label={onHold ? 'On hold' : 'Active'} tone={onHold ? 'warn' : 'good'} />
        {cardExpired && <Pill label="Card expired" tone="bad" />}
        {bandLabel[band] && (
          <Pill
            label={`${bandLabel[band]} ${i.retention_risk_score ?? ''}`.trim()}
            tone={bandTone[band]}
          />
        )}
      </div>

      {i.call_reason && (
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          Calling about: {i.call_reason}
        </div>
      )}

      {i.next_best_action?.offer && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 8,
            padding: '8px 9px',
            borderRadius: 8,
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(52,211,153,0.35)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: c.emerald,
              marginBottom: 3,
            }}
          >
            Recommended
          </div>
          {i.next_best_action.offer}
        </div>
      )}

      {a.ai_summary && (
        <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>{a.ai_summary}</div>
      )}
    </div>
  )
}

export const MemberSummary = withTaskContext(MemberSummaryBase)
