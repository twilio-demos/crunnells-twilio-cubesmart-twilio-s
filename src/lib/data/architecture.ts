export interface ArchChip {
  label: string
  active?: boolean
}

export interface ArchStage {
  id: string
  title: string
  description?: string
  /** Accent hex used for the card border and tint. */
  accent: string
  chips?: ArchChip[]
}

const MINT = '#74fbd0'
const NEPTUNE = '#6923f4'
const TWILIO_RED = '#f22f46'

export const architectureStages: ArchStage[] = [
  {
    id: 'touchpoints',
    title: 'Tenant Touchpoints',
    accent: MINT,
    description:
      'A prospect or tenant calls the store, texts, or opens the CubeSmart app or site. Every one of these surfaces is already live across the portfolio.',
    chips: [
      { label: 'Store phone line' },
      { label: 'SMS' },
      { label: 'CubeSmart app' },
      { label: 'Web booking' },
      { label: 'Gate kiosk' },
      { label: 'Email' },
      { label: 'RCS' },
    ],
  },
  {
    id: 'kore',
    title: 'CubeSmart Management Platform',
    accent: NEPTUNE,
    description:
      "CubeSmart's modernized system of record for leases, billing, access control and store operations across 1,516 owned and third-party managed properties.",
    chips: [
      { label: 'Management Platform', active: true },
      { label: 'Lease Management' },
      { label: 'Billing & Autopay' },
      { label: 'Gate Access Control' },
      { label: '+ more' },
    ],
  },
  {
    id: 'harness',
    title: 'Unified Integration Layer',
    accent: NEPTUNE,
    description:
      'One integration layer underneath the CubeSmart Management Platform. CubeSmart builds and governs it once, and every store inherits it.',
  },
  {
    id: 'tac',
    title: 'Twilio Agent Connect',
    accent: TWILIO_RED,
    description:
      "CubeSmart's AI leasing and retention agents plug into voice and messaging without rebuilding communications logic — model-agnostic, self-hosted, swappable.",
  },
  {
    id: 'twilio',
    title: 'Twilio Platform',
    accent: TWILIO_RED,
    chips: [
      { label: 'Conversation Orchestrator' },
      { label: 'Conversation Memory' },
      { label: 'Conversational Intelligence' },
      { label: 'Conversation Relay' },
      { label: 'Voice & Messaging' },
      { label: 'Verify' },
      { label: 'Branded RCS' },
      { label: '10DLC/A2P' },
    ],
  },
]
