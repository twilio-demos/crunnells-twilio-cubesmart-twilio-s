import { withApiHandler } from '@/lib/api-handler'
import { twilioClient } from '@/lib/twilio'

const VERIFY_SID = process.env.TWILIO_VERIFY_SID ?? ''

export const POST = withApiHandler(async (req) => {
  try {
    const { phoneNumber, code } = await req.json()

    if (!phoneNumber || !code) {
      return Response.json({ error: 'phoneNumber and code are required' }, { status: 400 })
    }

    const verificationCheck = await twilioClient.verify.v2
      .services(VERIFY_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      })

    if (verificationCheck.status === 'approved') {
      return Response.json({ status: 'approved', valid: true })
    }

    return Response.json({ status: verificationCheck.status, valid: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check verification'
    return Response.json({ error: message }, { status: 500 })
  }
})
