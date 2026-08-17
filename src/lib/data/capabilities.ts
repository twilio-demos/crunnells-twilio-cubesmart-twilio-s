export interface CapabilityMessage {
  from: 'member' | 'assistant'
  text: string
  chips?: string[]
}

export interface CallScreen {
  callerName: string
  reason: string
  insight: string
}

export interface RcsCard {
  title: string
  subtitle: string
  photo: string
}

export interface RcsData {
  intro: string
  quickReply: string
  cards: RcsCard[]
}

export interface Capability {
  id: string
  product: string
  title: string
  description: string
  accent: string
  type?: 'chat' | 'call' | 'rcs' | 'video'
  messages?: CapabilityMessage[]
  callScreen?: CallScreen
  rcs?: RcsData
  videoEmbedUrl?: string
  videoUrl?: string
  imageUrl?: string
  /** Still frame shown until the card is clicked, at which point imageUrl (the animation) plays. */
  posterUrl?: string
  /** Renders on its own full-width row beneath the phone mockups. */
  wide?: boolean
  live?: boolean
  note?: string
}

export const capabilities: Capability[] = [
  {
    id: 'conversation-relay',
    product: 'ConversationRelay',
    title: 'Guided Move-In Voice AI',
    description:
      'A natural-sounding AI voice agent answers every call — checking unit availability, quoting pricing, and booking a move-in appointment — with zero hold time, even after the store closes.',
    accent: '#74fbd0',
    live: true,
    messages: [
      { from: 'member', text: "Hi, do you have a 10x10 climate-controlled unit open this week?" },
      { from: 'assistant', text: "Yes — one 10x10 climate-controlled unit just opened up at West 7th. Want me to text you photos, pricing and a move-in time?" },
      { from: 'member', text: 'Yes please, and text me a confirmation.' },
      { from: 'assistant', text: "Done! I've sent the unit carousel and your move-in confirmation to your phone." },
    ],
  },
  {
    id: 'branded-calling',
    product: 'Branded Calling + Voice Insights',
    title: 'Smarter Outbound Calling',
    description:
      'A verified name and reason for calling earn far more answered calls — Voice Insights tells the leasing team exactly when to call a lead for the best pickup rate and ROI.',
    accent: '#6923f4',
    type: 'call',
    callScreen: {
      callerName: 'CubeSmart',
      reason: 'Your Reserved Unit Is Ready',
      insight: 'Best time to call: 5–7pm · 42% higher answer rate',
    },
  },
  {
    id: 'rcs',
    product: 'RCS Business Messaging',
    title: 'Rich, Two-Way Messaging',
    description:
      'Imagery, carousels, and quick-reply buttons turn a plain text into a booking engine — pick a unit, confirm a move-in time, get gate directions, and pay a past-due balance. No app required.',
    accent: '#f44e27',
    type: 'rcs',
    rcs: {
      intro: 'Hey Maya, here are today\u2019s open units at CubeSmart West 7th!',
      quickReply: 'Book This Unit',
      cards: [
        {
          title: '10x10 Climate-Controlled — $149/mo',
          subtitle: 'Building A, ground floor',
          photo: 'https://images.pexels.com/photos/38573375/pexels-photo-38573375.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        },
        {
          title: '10x15 Drive-Up Access — $179/mo',
          subtitle: 'Building C, outdoor row',
          photo: 'https://images.pexels.com/photos/5759037/pexels-photo-5759037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        },
        {
          title: '5x10 Wardrobe Unit — $89/mo',
          subtitle: 'Building A, second floor',
          photo: 'https://images.pexels.com/photos/5759145/pexels-photo-5759145.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        },
      ],
    },
  },
  {
    id: 'whatsapp',
    product: 'WhatsApp Business',
    title: 'Global Tenant Messaging',
    description:
      'Reach tenants and prospects on the channel they already use every day — ideal for out-of-town movers and multi-property renters comparing locations.',
    accent: '#25D366',
    messages: [
      { from: 'member', text: 'Hey! Do you have a CubeSmart near West 7th?' },
      { from: 'assistant', text: "Yes! Our West 7th store has 10x10 and 10x15 units open this week. Want photos or a move-in link?" },
      { from: 'member', text: 'Move-in link please 🙏' },
    ],
  },
  {
    id: 'conversations-classic',
    product: 'Conversations',
    title: 'Every Channel, One View',
    description:
      'SMS, RCS, WhatsApp and voice call summaries — plus click-to-call — so the store team picks up right where the last conversation left off, no matter which channel a tenant used last.',
    accent: '#6923f4',
    wide: true,
    imageUrl: 'https://images.pexels.com/photos/8867472/pexels-photo-8867472.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    messages: [
      { from: 'member', text: 'Can I switch my 10x10 to a 10x15 before I move in?' },
      { from: 'assistant', text: "You're all set for the 10x15 Drive-Up in Building C — same move-in date. See you at the gate!" },
      { from: 'member', text: 'Perfect, thank you!' },
    ],
  },
]
