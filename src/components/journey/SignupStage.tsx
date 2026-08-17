'use client'

import { useState } from 'react'
import { CubeSmartWordmark } from './EmeraldMark'
import type { JourneyConfig, LookupResponse } from '@/lib/journey/types'

interface SignupStageProps {
  config: JourneyConfig
  onComplete: () => Promise<void> | void
}

function Chip({
  label,
  value,
  tone = 'idle',
}: {
  label: string
  value: string
  tone?: 'idle' | 'good' | 'bad' | 'pending'
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald/50 bg-emerald/10 text-emerald-glow'
      : tone === 'bad'
        ? 'border-red-500/40 bg-red-500/10 text-red-300'
        : tone === 'pending'
          ? 'border-white/15 bg-white/5 text-white/50'
          : 'border-white/10 bg-white/[0.03] text-white/40'
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-[0.15em] opacity-70">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold">{value}</p>
    </div>
  )
}

export function SignupStage({ config, onComplete }: SignupStageProps) {
  const [firstName, setFirstName] = useState(config.persona.firstName)
  const [lastName, setLastName] = useState(config.persona.lastName)
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [lookup, setLookup] = useState<LookupResponse | null>(null)
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const call = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetch(`/api/journey/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error(data?.error || 'Something went wrong.')
    return data
  }

  const runLookup = async () => {
    setBusy('lookup')
    setError(null)
    try {
      const result = await call<LookupResponse>('lookup', { phone })
      setLookup(result)
    } catch (err) {
      setError((err as Error).message)
      setLookup(null)
    } finally {
      setBusy(null)
    }
  }

  const sendCode = async () => {
    setBusy('verify')
    setError(null)
    try {
      await call('verify/start', { phone })
      setStep('code')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const checkCode = async () => {
    setBusy('check')
    setError(null)
    try {
      await call('verify/check', {
        phone,
        code,
        firstName,
        lastName,
        lineType: lookup?.lineType,
        carrier: lookup?.carrier,
        nationalFormat: lookup?.nationalFormat,
      })
      await onComplete()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const canLookup = phone.replace(/\D/g, '').length >= 10
  const canVerify = canLookup && consent && lookup?.valid && firstName && lastName

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {/* Fake site chrome so it reads as the studio's own signup page */}
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/40 px-5 py-3">
          <CubeSmartWordmark />
          <span className="rounded-full bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-white/40">
            cubesmart.com/reserve/west-7th
          </span>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <h3 className="font-heading text-lg font-semibold text-starwhite">
                Reserve a unit at West 7th
              </h3>
              <p className="mt-1 text-[12px] text-white/50">
                {config.brand.address} · {config.brand.hours}
              </p>
            </div>

            {step === 'form' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First name"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="Maya"
                  />
                  <Field
                    label="Last name"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Ellison"
                  />
                </div>

                <div>
                  <Field
                    label="Mobile number"
                    value={phone}
                    onChange={(v) => {
                      setPhone(v)
                      setLookup(null)
                    }}
                    placeholder="(555) 123-4567"
                    onBlur={canLookup ? runLookup : undefined}
                  />
                  <button
                    type="button"
                    onClick={runLookup}
                    disabled={!canLookup || busy === 'lookup'}
                    className="mt-2 text-[11px] font-medium text-emerald-glow underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    {busy === 'lookup' ? 'Checking the line…' : 'Check this number'}
                  </button>
                </div>

                <label className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald"
                  />
                  <span className="text-[11px] leading-relaxed text-white/60">
                    Yes, text me at this number about my reservation, gate access and supply orders
                    from CubeSmart. Message and data rates may apply. Reply STOP to opt out
                    at any time. See our{' '}
                    <span className="text-emerald-glow">privacy notice</span>.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={sendCode}
                  disabled={!canVerify || busy === 'verify'}
                  className="w-full rounded-lg bg-emerald px-4 py-3 font-heading text-sm font-semibold text-emerald-ink transition hover:bg-emerald-glow disabled:opacity-40"
                >
                  {busy === 'verify' ? 'Sending your code…' : 'Reserve my unit'}
                </button>
                {!consent && canLookup && (
                  <p className="text-[10px] text-white/35">
                    Nothing is sent until the opt-in box is ticked.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] text-white/60">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-white">
                    {lookup?.nationalFormat || phone}
                  </span>
                  . Enter it to confirm the number is yours.
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="••••••"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-emerald"
                />
                <button
                  type="button"
                  onClick={checkCode}
                  disabled={code.length < 4 || busy === 'check'}
                  className="w-full rounded-lg bg-emerald px-4 py-3 font-heading text-sm font-semibold text-emerald-ink transition hover:bg-emerald-glow disabled:opacity-40"
                >
                  {busy === 'check' ? 'Confirming…' : 'Confirm my number'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  ← Use a different number
                </button>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                {error}
              </p>
            )}
          </div>

          {/* Live Lookup panel */}
          <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-glow">
                Twilio Lookup — live
              </h4>
              {busy === 'lookup' && (
                <span className="text-[10px] text-white/40">checking…</span>
              )}
            </div>

            {!lookup ? (
              <p className="text-[11px] leading-relaxed text-white/35">
                Enter her number and we&apos;ll validate it before a single marketing message
                goes out — is it real, is it a mobile line, which carrier, and can it receive
                rich messages.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Chip
                  label="Valid number"
                  value={lookup.valid ? 'Yes' : 'No'}
                  tone={lookup.valid ? 'good' : 'bad'}
                />
                <Chip
                  label="Line type"
                  value={lookup.lineType ?? 'unknown'}
                  tone={lookup.lineType === 'mobile' ? 'good' : 'bad'}
                />
                <Chip label="Carrier" value={lookup.carrier ?? 'unknown'} tone="pending" />
                <Chip
                  label="Country"
                  value={lookup.countryCode ?? '—'}
                  tone="pending"
                />
                <div className="col-span-2">
                  <Chip
                    label="RCS delivery"
                    value={
                      lookup.rcsEligible
                        ? 'RCS-first, SMS fallback'
                        : 'SMS only'
                    }
                    tone={lookup.rcsEligible ? 'good' : 'bad'}
                  />
                </div>
                <div className="col-span-2">
                  <Chip
                    label="Ownership"
                    value={step === 'code' ? 'Verify code sent' : 'Not yet confirmed'}
                    tone={step === 'code' ? 'pending' : 'idle'}
                  />
                </div>
              </div>
            )}

            <p className="border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-white/30">
              Branded RCS is sent from the verified CubeSmart sender. The confirmed
              delivery channel comes back on the very first message and shows in the thread.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onBlur?: () => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-white/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald"
      />
    </label>
  )
}
