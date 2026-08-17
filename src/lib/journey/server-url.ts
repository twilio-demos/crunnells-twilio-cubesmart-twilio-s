/**
 * Resolves the URL of the journey/voice service (the Railway-hosted server).
 *
 * Priority:
 *  1. NEXT_PUBLIC_VOICE_SERVER_URL — the explicit setting
 *  2. VOICE_SERVER_URL             — server-side alias
 *  3. TWILIO_VOICE_PUBLIC_DOMAIN   — already set for the Twilio voice webhooks,
 *                                    which is the same host, so it's a safe fallback
 *                                    and keeps the journey working if 1 & 2 are blank.
 */
export function resolveJourneyServerUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_VOICE_SERVER_URL ||
    process.env.VOICE_SERVER_URL ||
    process.env.TWILIO_VOICE_PUBLIC_DOMAIN ||
    ''

  if (!raw) return ''
  const trimmed = raw.trim().replace(/\/$/, '')
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}
