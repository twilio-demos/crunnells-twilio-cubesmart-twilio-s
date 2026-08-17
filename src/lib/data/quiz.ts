export interface QuizOption {
  text: string
  score: number
}

export interface QuizQuestion {
  id: string
  question: string
  options: QuizOption[]
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'channels',
    question: 'How are your voice, SMS, and chat channels connected today?',
    options: [
      { text: 'They are completely separate — messaging on one number, calls forwarded to a different business line', score: 1 },
      { text: 'Voice and SMS run on the exact same number, with call summaries flowing to our CRM', score: 2 },
      { text: 'Most channels (SMS, WhatsApp, RCS) share a unified inbox and customer profile', score: 3 },
      { text: 'AI assists staff across every channel with shared context', score: 4 },
      { text: 'An AI agent handles most interactions end-to-end across every channel', score: 5 },
      { text: 'Every channel is natively embedded in our own product via Flex SDK, with built-in task routing', score: 6 },
    ],
  },
  {
    id: 'response-time',
    question: 'How quickly do new leads or member questions get a response?',
    options: [
      { text: 'Hours or days, if at all', score: 1 },
      { text: 'Within a business day via manual follow-up', score: 2 },
      { text: 'Within minutes thanks to automated workflows', score: 3 },
      { text: 'Instantly, with AI drafting or suggesting responses', score: 4 },
      { text: 'Instantly and fully autonomously, 24/7', score: 5 },
      { text: 'Instantly, natively inside our own embedded product surface — no separate tool at all', score: 6 },
    ],
  },
  {
    id: 'voice-intelligence',
    question: 'What happens with the data captured on a phone call today?',
    options: [
      { text: 'Nothing — calls happen on a separate line with no notes or recording', score: 1 },
      { text: 'A staff member manually types notes into the CRM afterward, if at all', score: 2 },
      { text: 'Calls are transcribed and summarized automatically, with sentiment and dispositions pushed to our CRM', score: 3 },
      { text: 'That data personalizes AI-assisted follow-up across every channel', score: 4 },
      { text: 'An AI agent acts on it in real time — rebooking, escalating, or following up automatically', score: 5 },
      { text: 'It flows natively into our own embedded task routing and reporting, no separate systems', score: 6 },
    ],
  },
  {
    id: 'ai-usage',
    question: "What's your current use of AI in communications?",
    options: [
      { text: 'None', score: 1 },
      { text: 'Basic scripted IVR or chatbots', score: 2 },
      { text: 'AI-assisted routing or FAQ answers over text', score: 3 },
      { text: 'Generative AI drafts responses for staff to approve', score: 4 },
      { text: 'Autonomous AI agents resolve most requests independently, including by voice', score: 5 },
      { text: 'Embedded, autonomous AI agents run natively inside our own product', score: 6 },
    ],
  },
  {
    id: 'escalation',
    question: 'When should a human get involved?',
    options: [
      { text: 'Humans handle everything, always — there is no automation yet', score: 1 },
      { text: 'Humans handle everything beyond a basic text confirmation', score: 2 },
      { text: 'Humans handle anything outside a defined chat workflow', score: 3 },
      { text: 'Humans review or approve AI-drafted responses', score: 4 },
      { text: 'Humans only step in for true exceptions the AI flags', score: 5 },
      { text: 'Embedded task routing sends exceptions to the right internal team automatically', score: 6 },
    ],
  },
]
