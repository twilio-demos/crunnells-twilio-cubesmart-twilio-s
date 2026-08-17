import React from 'react'
import { withTaskContext, ITask } from '@twilio/flex-ui'
import { hasCubeSmartContext, prettyPhone, readAttributes } from '../context'
import { palette as c, font } from '../theme'
import { IntelligenceBlock, NextBestActionCard } from './Intelligence'
import { Callout, CubeSmartMark, Field, Grid, Pill, Section } from './primitives'

function titleCase(value?: string): string {
  const s = String(value ?? '').replace(/[-_]/g, ' ')
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div
      style={{
        fontFamily: font,
        background: c.bg,
        color: c.dim,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ marginBottom: 10 }}>
          <CubeSmartMark size={30} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 4 }}>
          CubeSmart — Tenant Context
        </div>
        <div style={{ fontSize: 12, maxWidth: 280, lineHeight: 1.5 }}>
          {message ?? 'Select a task to see the tenant the AI agent is handing you.'}
        </div>
      </div>
    </div>
  )
}

/**
 * Replaces the Flex CRM container. Everything rendered here arrives on the task
 * attributes from the CubeSmart voice agent at the moment it escalates — no
 * extra API call, so it is on screen before the agent says hello.
 */
export function MemberContextPanelBase({ task }: { task?: ITask }) {
  if (!task) return <EmptyState />

  const a = readAttributes(task)
  if (!hasCubeSmartContext(a)) {
    return (
      <EmptyState message="This task did not arrive from the CubeSmart voice agent, so there is no tenant context attached." />
    )
  }

  const e = a.cubesmart ?? {}
  const name = a.customerName || a.name || a.customers?.name || '—'
  const extendedAccess = e.account_status === 'on-hold'
  const cardExpired = e.payment_status === 'expired'
  const history = e.reservation_history ?? []
  const transcript = a.recent_transcript ?? []

  return (
    <div
      style={{
        fontFamily: font,
        background: c.bg,
        color: c.text,
        height: '100%',
        overflowY: 'auto',
        padding: '14px 14px 28px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 12,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <CubeSmartMark size={24} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 11, color: c.dim, marginTop: 2 }}>
            {prettyPhone(a.from || a.customers?.phone)} · {e.store ?? 'CubeSmart'}
          </div>
        </div>
        <Pill
          label={extendedAccess ? 'Extended access' : titleCase(e.account_status ?? 'tenant')}
          tone={extendedAccess ? 'warn' : 'good'}
        />
      </div>

      {a.intelligence?.next_best_action?.offer ? (
        <div style={{ marginTop: 14 }}>
          <NextBestActionCard nba={a.intelligence.next_best_action} />
        </div>
      ) : null}

      <IntelligenceBlock intel={a.intelligence} />

      {(a.escalation_reason || a.ai_summary) && (
        <Section title="Why this call reached you">
          <Callout title={a.escalation_reason ?? 'Escalated by the voice agent'}>
            {a.ai_summary ?? 'No summary was provided.'}
          </Callout>
          <div style={{ fontSize: 10, color: c.faint, marginTop: 6 }}>
            Handed over by {a.escalated_by ?? 'the voice AI'}
          </div>
        </Section>
      )}

      {cardExpired && (
        <Section title="Needs resolving">
          <Callout title="Autopay declined" tone="bad">
            {e.card_on_file ?? 'Card on file has expired'}
            {e.failed_charge ? ` — ${e.failed_charge} could not be processed.` : ''}
          </Callout>
        </Section>
      )}

      <Section title="Unit & lease">
        <Grid>
          <Field label="Unit type" value={e.unit_type ?? '—'} />
          <Field
            label="Account status"
            value={extendedAccess ? 'Extended access' : titleCase(e.account_status)}
            tone={extendedAccess ? 'warn' : 'good'}
          />
          <Field label="Access window starts" value={e.access_window_start ?? '—'} tone={extendedAccess ? 'warn' : undefined} />
          <Field label="Access window ends" value={e.access_window_end ?? '—'} tone={extendedAccess ? 'warn' : undefined} />
          <Field label="Access window length" value={e.access_window_days ? `${e.access_window_days} days` : '—'} />
          <Field
            label="Autopay"
            value={cardExpired ? 'Expired' : titleCase(e.payment_status)}
            tone={cardExpired ? 'bad' : 'good'}
          />
          <Field label="Card on file" value={e.card_on_file ?? '—'} />
          <Field
            label="Failed charge"
            value={e.failed_charge ?? 'None'}
            tone={e.failed_charge ? 'bad' : undefined}
          />
        </Grid>
      </Section>

      <Section title="Preferences & activity">
        <Grid>
          <Field label="Units reserved" value={String(e.units_booked ?? 0)} />
          <Field
            label="Last rating given"
            value={e.last_staff_rating ? `${e.last_staff_rating} / 5` : '—'}
          />
          <Field label="Usual supply order" value={e.usual_supply_order ?? 'None yet'} />
          <Field label="Home store" value={e.store ?? '—'} />
        </Grid>
      </Section>

      <Section title="Reservation history">
        {history.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {history.map((line, i) => {
              const cancelled = line.toLowerCase().includes('cancelled')
              return (
                <div
                  key={`ch${i}`}
                  style={{
                    fontSize: 11.5,
                    color: cancelled ? c.faint : c.dim,
                    background: c.soft,
                    border: `1px solid ${c.line}`,
                    borderRadius: 7,
                    padding: '6px 9px',
                    textDecoration: cancelled ? 'line-through' : 'none',
                  }}
                >
                  {line}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: c.faint }}>Nothing on record yet.</div>
        )}
      </Section>

      {transcript.length > 0 && (
        <Section title="What she just said">
          <div
            style={{
              background: c.panel,
              border: `1px solid ${c.line}`,
              borderRadius: 10,
              padding: '10px 11px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            {transcript.map((line, i) => {
              const split = line.indexOf(':')
              const who = split > 0 ? line.slice(0, split) : ''
              const said = split > 0 ? line.slice(split + 1).trim() : line
              const isAgent = who.toLowerCase().includes('voice ai')
              return (
                <div key={`tr${i}`}>
                  {who && (
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: isAgent ? 'rgba(255,165,82,0.7)' : c.faint,
                        marginBottom: 2,
                      }}
                    >
                      {who}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: isAgent ? c.dim : c.text }}>
                    {said}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 10,
          borderTop: `1px solid ${c.line}`,
          fontSize: 9.5,
          color: c.faint,
          lineHeight: 1.6,
        }}
      >
        <div>Twilio Memory profile: {e.memory_profile_id ?? '—'}</div>
        <div>Task: {task.taskSid}</div>
        <div>Delivered on the task attributes by the CubeSmart voice agent.</div>
      </div>
    </div>
  )
}

export const MemberContextPanel = withTaskContext(MemberContextPanelBase)
