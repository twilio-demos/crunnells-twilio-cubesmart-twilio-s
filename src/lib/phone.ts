/**
 * Formats a phone number to E.164 format.
 * Strips all non-digit characters, then prepends +1 (US) if no country code is present.
 */
export function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (phone.startsWith('+')) {
    return `+${digits}`
  }

  return `+${digits}`
}
