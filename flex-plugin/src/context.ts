/** Shape of the task attributes the CubeSmart voice agent hands to Flex. */

export interface CubeSmartContext {
  store?: string
  unit_type?: string
  account_status?: 'active' | 'on-hold' | string
  access_window_start?: string | null
  access_window_end?: string | null
  access_window_days?: number | null
  payment_status?: 'current' | 'expired' | string
  card_on_file?: string
  failed_charge?: string | null
  units_booked?: number
  reservation_history?: string[]
  usual_supply_order?: string | null
  last_staff_rating?: number | null
  memory_profile_id?: string | null
  memory_store_id?: string | null
}

export interface CubeSmartNextBestAction {
  headline?: string
  offer?: string
  rationale?: string | null
  policy_source?: string | null
  urgency?: string | null
}

/** Live Conversation Intelligence, patched onto the task while the call runs. */
export interface CubeSmartIntelligence {
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
  next_best_action?: CubeSmartNextBestAction | null
  operator_runs?: number | null
  last_operator?: string | null
  last_latency_ms?: number | null
  updated_at?: string | null
}

export interface CubeSmartTaskAttributes {
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
  cubesmart?: CubeSmartContext
  intelligence?: CubeSmartIntelligence | null
}

export function readAttributes(task: unknown): CubeSmartTaskAttributes {
  const raw = (task as { attributes?: unknown } | null)?.attributes
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CubeSmartTaskAttributes
    } catch {
      return {}
    }
  }
  return raw as CubeSmartTaskAttributes
}

export function hasCubeSmartContext(attributes: CubeSmartTaskAttributes): boolean {
  return Boolean(attributes.cubesmart?.unit_type || attributes.customerName || attributes.name)
}

// Kept as an alias so the old import name still resolves.
export const hasEmeraldContext = hasCubeSmartContext

export function prettyPhone(raw?: string): string {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw || '—'
}
