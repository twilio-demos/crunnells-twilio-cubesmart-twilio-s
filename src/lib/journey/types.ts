/** Shared shapes for the Emerald Fitness guided member journey workspace. */

export interface JourneyBeat {
  id: string
  act: string
  actLabel: string
  step: string
  title: string
  narration: string
  mechanic: string
  stage:
    | 'narration'
    | 'signup'
    | 'thread'
    | 'booking'
    | 'call-prompt'
    | 'call-live'
    | 'desk'
    | 'save'
  action?: string
  waiting?: string
  events?: string[]
}

export interface ClassSlot {
  id: string
  dateISO: string
  time: string
  dayName: string
  shortDate: string
  timeLabel: string
  label: string
  className: string
  instructor: string
  duration: number
  room: string
  spotsLeft: number
}

export interface JourneyConfig {
  brand: {
    name: string
    studio: string
    address: string
    city: string
    hours: string
    fuelBar: string
  }
  persona: { firstName: string; lastName: string; age: number; blurb: string }
  beats: JourneyBeat[]
  drinks: { key: string; name: string; body: string; media: string; calories: number; protein: number }[]
  instructors: string[]
  studioPhone: string
  schedule: ClassSlot[]
  thursday: string
  /** The live retention score at which the studio treats her as a churn risk. */
  riskThreshold?: number
  saveOffer?: { classCredit: string; coaching: string; label: string }
  rcsSender: string
  rcs?: RcsHealth
  flex?: FlexHealth
  intel?: IntelHealth
  ready: boolean
}

/** Live Conversation Intelligence signals for the call in progress. */
export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed'
export type RiskBand = 'low' | 'watch' | 'elevated' | 'high'

export interface JourneyIntel {
  callNumber: number
  reason?: { reason: string; confidence: number; evidence?: string; at: string }
  sentiment?: { label: SentimentLabel; at: string }
  sentimentTrail: { label: SentimentLabel; at: string }[]
  risk?: {
    score: number
    band: RiskBand
    drivers: string[]
    quote?: string
    trend?: 'rising' | 'steady' | 'falling'
    at: string
  }
  riskTrail: { score: number; at: string }[]
  /** Only ever shown to the human agent in Flex, never on the member-facing screen. */
  nextBestAction?: {
    recommend: boolean
    headline: string
    offer: string
    rationale?: string
    policySource?: string
    urgency?: string
    at: string
  }
  runs: {
    operator: string
    latencyMs?: number
    model?: string
    trigger?: string
    at: string
  }[]
  totalRuns: number
  conversationId?: string
  updatedAt?: string
}

export interface IntelHealth {
  configId?: string
  configName?: string
  attached: boolean
  operators: string[]
  knowledgeBaseId?: string
  webhookUrl?: string
  receiving: boolean
  lastResultAt?: string
  ok: boolean
  problem?: string
  hint?: string
  checkedAt: string
}

export interface FlexHealth {
  workspaceSid?: string
  workflowSid?: string
  taskQueueSid?: string
  flexUrl: string
  configured: boolean
  workflowName?: string
  queueName?: string
  workersTotal: number
  workersAvailable: number
  availableWorkerNames: string[]
  pluginReleased: boolean
  pluginVersion?: string
  pluginUrl?: string
  ok: boolean
  problem?: string
  hint?: string
  checkedAt: string
}

export interface FlexHandoff {
  taskSid?: string
  status?: string
  worker?: string
  queue?: string
  workflowSid?: string
  workspaceSid?: string
  attributes?: Record<string, unknown>
  transferred: boolean
  transferredAt?: string
  callSid?: string
  error?: string
}

export interface JourneyMessage {
  id: string
  direction: 'outbound' | 'inbound'
  channel: 'rcs' | 'sms' | 'voice'
  kind: 'text' | 'carousel' | 'card' | 'system'
  body?: string
  cards?: {
    title: string
    body: string
    media?: string
    buttons: { title: string; payload: string }[]
  }[]
  buttons?: { title: string; payload: string }[]
  timestamp: string
  sid?: string
  /** False until Twilio confirms which channel actually carried the message. */
  channelConfirmed?: boolean
  deliveryStatus?: string
  /** True when RCS was attempted but the message really went out over SMS. */
  fellBackToSms?: boolean
  errorCode?: number
  fallbackReason?: string
}

export interface RcsHealth {
  senderId: string
  displayName?: string
  senderStatus?: string
  inSenderPool: boolean
  ok: boolean
  problem?: string
  hint?: string
  checkedAt: string
}

export interface JourneyEventRecord {
  id: string
  name: string
  detail?: string
  timestamp: string
}

export interface BookedClass {
  slotId: string
  className: string
  instructor: string
  dateISO: string
  timeLabel: string
  dayName: string
  shortDate: string
  duration: number
  room: string
  status: 'booked' | 'cancelled' | 'attended'
  bookedAt: string
}

export interface TranscriptLine {
  id: string
  role: 'member' | 'agent' | 'tool' | 'system'
  text: string
  timestamp: string
}

export interface JourneyState {
  phone: string
  firstName: string
  lastName: string
  createdAt: string
  beatId: string
  completed: string[]
  profileId?: string
  lookup?: {
    phone: string
    valid: boolean
    nationalFormat?: string
    lineType?: string
    carrier?: string
    rcsCapable: boolean
  }
  verified: boolean
  consentAt?: string
  classes: BookedClass[]
  bookingRound: 1 | 2
  reminderSlotId?: string
  reminderResponse?: 'confirmed' | 'late' | 'cancelled'
  fuelOrder?: { name: string; calories: number; protein: number; orderedAt: string }
  instructorRating?: number
  rebook?: { day?: string; offeredSlotIds?: string[]; fromSlotId?: string; toSlotId?: string }
  membership: {
    tier: string
    status: 'active' | 'on-hold'
    holdStart?: string
    holdEnd?: string
    holdDays?: number
    paymentStatus: 'current' | 'expired'
    cardLast4: string
    cardExpiry: string
    failedChargeAmount?: string
    failedChargeAt?: string
  }
  messages: JourneyMessage[]
  events: JourneyEventRecord[]
  transcript: TranscriptLine[]
  callStatus: 'idle' | 'ringing' | 'in-call' | 'ended'
  callCount: number
  callSid?: string
  greeting?: string
  transferring?: boolean
  escalation?: { reason: string; summary: string; createdAt: string; handledBy?: string }
  flex?: FlexHandoff
  intel?: JourneyIntel
  /** Set the first time the live retention score crossed the studio's threshold. */
  riskThresholdAt?: string
  riskThresholdScore?: number
  /** The save the front desk actually made, once recorded. */
  save?: {
    offer: string
    classCredit: string
    coaching: string
    cardLast4: string
    cardExpiry: string
    completedAt: string
  }
  upcoming?: BookedClass[]
  next?: BookedClass | null
}

export interface ProfileSnapshot {
  profileId?: string
  traits: { group: string; name: string; value: unknown; updatedAt?: string }[]
  observations: { id: string; content: string; source?: string; occurredAt?: string }[]
  summaries: { id: string; summary: string; createdAt?: string }[]
}

export interface LookupResponse {
  phone: string
  valid: boolean
  nationalFormat?: string
  countryCode?: string
  lineType?: string
  carrier?: string
  rcsEligible: boolean
  validationErrors?: string[]
  error?: string
}
