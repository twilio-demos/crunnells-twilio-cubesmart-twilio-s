import { withApiHandler } from '@/lib/api-handler'
import { twilioClient } from '@/lib/twilio'

const VERIFY_SID = process.env.TWILIO_VERIFY_SID ?? ''

export const POST = withApiHandler(async (req) => {
  try {
    const { phoneNumber } = await req.json()

    if (!phoneNumber) {
      return Response.json({ error: 'phoneNumber is required' }, { status: 400 })
    }

    const verification = await twilioClient.verify.v2
      .services(VERIFY_SID)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms',
      })

    return Response.json({ status: verification.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start verification'
    return Response.json({ error: message }, { status: 500 })
  }
})
