import { withApiHandler } from '@/lib/api-handler'

// Deprecated: Segment was removed from this showcase's narrative in favor of Twilio
// Conversations, Memory, Conversational Intelligence (CINTEL), Enterprise Knowledge, and
// Agent Connect. See HowItWorksSection.tsx. This route is intentionally inert.
export const GET = withApiHandler(async () => {
  return Response.json({ error: 'This endpoint has been deprecated and is no longer in use.' }, { status: 410 })
})
