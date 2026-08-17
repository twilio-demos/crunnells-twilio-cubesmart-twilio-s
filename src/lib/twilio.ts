import Twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
const apiKey = process.env.TWILIO_API_KEY ?? ''
const apiSecret = process.env.TWILIO_API_SECRET ?? ''

export const twilioClient = Twilio(apiKey, apiSecret, { accountSid })
