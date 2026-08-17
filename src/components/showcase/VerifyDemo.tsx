'use client'

import { useState } from 'react'
import { formatToE164 } from '@/lib/phone'

export function VerifyDemo() {
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    try {
      const formatted = formatToE164(phone)
      const res = await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formatted }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const check = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const formatted = formatToE164(phone)
      const res = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formatted, code }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) throw new Error(data.error || 'Incorrect code, try again')
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col h-full">
      <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-xplorange/15 text-xplorange self-start">
        Twilio Verify
      </span>
      <h3 className="mt-3 text-lg font-semibold text-starwhite">Secure Member Sign-Up</h3>
      <p className="mt-1.5 text-sm text-white/50">Real one-time-passcode verification — try it with your own phone.</p>

      <div className="mt-6 flex-1 flex flex-col justify-center gap-3">
        {step === 'phone' && (
          <>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full rounded-xl bg-deepspace border border-white/15 px-4 py-3 text-sm text-starwhite placeholder:text-white/30 focus:outline-none focus:border-mint"
            />
            <button
              onClick={start}
              disabled={loading || !phone.trim()}
              className="w-full rounded-xl bg-neptune hover:bg-neptune-hover disabled:opacity-40 transition-colors text-white text-sm font-semibold py-3"
            >
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-xs text-white/50">Code sent to {phone}. Enter it below.</p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-xl bg-deepspace border border-white/15 px-4 py-3 text-sm text-starwhite placeholder:text-white/30 focus:outline-none focus:border-mint"
            />
            <button
              onClick={check}
              disabled={loading || !code.trim()}
              className="w-full rounded-xl bg-neptune hover:bg-neptune-hover disabled:opacity-40 transition-colors text-white text-sm font-semibold py-3"
            >
              {loading ? 'Checking…' : 'Verify code'}
            </button>
            <button onClick={() => setStep('phone')} className="text-xs text-white/40 hover:text-white/70">
              ← use a different number
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-semibold text-mint">Verified!</p>
            <p className="text-xs text-white/50 mt-1">That&apos;s a real Twilio Verify check, completed in seconds.</p>
            <button onClick={() => { setStep('phone'); setPhone(''); setCode('') }} className="mt-4 text-xs text-white/40 hover:text-white/70">
              Try again
            </button>
          </div>
        )}

        {error && <p className="text-xs text-xplorange">{error}</p>}
      </div>
    </div>
  )
}
