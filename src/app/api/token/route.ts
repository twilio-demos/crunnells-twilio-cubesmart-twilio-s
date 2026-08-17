import twilio from 'twilio'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(async () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env

  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
    return Response.json({ error: 'Missing Twilio credentials' }, { status: 500 })
  }

  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  })

  const accessToken = new twilio.jwt.AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, {
    identity: `browser-visitor-${Math.random().toString(36).slice(2, 9)}`,
    ttl: 3600,
  })

  accessToken.addGrant(voiceGrant)

  return Response.json({ token: accessToken.toJwt() })
})
