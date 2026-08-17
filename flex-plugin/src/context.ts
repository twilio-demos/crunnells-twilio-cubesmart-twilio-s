/** Shape of the task attributes the Emerald Fitness voice agent hands to Flex. */

export interface EmeraldContext {
  studio?: string
  membership_tier?: string
  membership_status?: 'active' | 'on-hold' | string
  hold_start?: string | null
  hold_end?: string | null
  hold_days?: number | null
  payment_status?: 'current' | 'expired' | string
  card_on_file?: string
  failed_charge?: string | null
  classes_booked?: number
  class_history?: string[]
  favourite_shake?: string | null
  last_instructor_rating?: number | null
  memory_profile_id?: string | null
  memory_store_id?: string | null
}

export interface EmeraldNextBestAction {
  headline?: string
  offer?: string
  rationale?: string | null
  policy_source?: string | null
  urgency?: string | null
}

/** Live Conversation Intelligence, patched onto the task while the call runs. */
export interface EmeraldIntelligence {
  call_reason?: string | null
  call_reason_confidence?: number | null
  call_reason_evidence?: string | null
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' | string | null
  sentiment_trail?: string[]
  retention_risk_score?: number | null
  retention_risk_band?: 'low' | 'watch' | 'elevated' | 'high' | string | null
  retention_risk_drivers?: string[]
  retention_risk_quote?: string | null
  retention_risk_trend?: 'rising' | 'steady' | 'falling' | string | null
  next_best_action?: EmeraldNextBestAction | null
  operator_runs?: number | null
  last_operator?: string | null
  last_latency_ms?: number | null
  updated_at?: string | null
}

export interface EmeraldTaskAttributes {
  type?: string
  direction?: string
  name?: string
  customerName?: string
  from?: string
  called?: string
  customers?: { phone?: string; name?: string; external_id?: string }
  escalated_by?: string
  escalation_reason?: string
  ai_summary?: string
  recent_transcript?: string[]
  emerald?: EmeraldContext
  intelligence?: EmeraldIntelligence | null
}

export function readAttributes(task: unknown): EmeraldTaskAttributes {
  const raw = (task as { attributes?: unknown } | null)?.attributes
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as EmeraldTaskAttributes
    } catch {
      return {}
    }
  }
  return raw as EmeraldTaskAttributes
}

export function hasEmeraldContext(attributes: EmeraldTaskAttributes): boolean {
  return Boolean(attributes.emerald?.membership_tier || attributes.customerName || attributes.name)
}

export function prettyPhone(raw?: string): string {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw || '—'
}
