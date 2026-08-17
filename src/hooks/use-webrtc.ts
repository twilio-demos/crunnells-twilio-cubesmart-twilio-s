'use client'

import { Call, Device } from '@twilio/voice-sdk'
import { useEffect, useRef, useState } from 'react'

export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'disconnected' | 'error'

export function useTwilioDevice() {
  const deviceRef = useRef<Device | null>(null)
  const activeCallRef = useRef<Call | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')

  useEffect(() => {
    let device: Device | null = null

    async function setupDevice() {
      try {
        const response = await fetch('/api/token')
        if (!response.ok) return
        const { token } = await response.json()
        if (!token) return

        device = new Device(token, { logLevel: 1 })
        device.on('registered', () => setIsReady(true))
        device.on('unregistered', () => setIsReady(false))
        device.on('error', () => setCallStatus('error'))
        await device.register()
        deviceRef.current = device
      } catch {
        setCallStatus('error')
      }
    }

    setupDevice()
    return () => {
      device?.destroy()
      deviceRef.current = null
    }
  }, [])

  const handleCall = async (to: string) => {
    if (!deviceRef.current || !to.trim()) return
    setCallStatus('connecting')

    const call = await deviceRef.current.connect({ params: { To: to.trim() } })
    activeCallRef.current = call

    call.on('ringing', () => setCallStatus('ringing'))
    call.on('accept', () => setCallStatus('in-call'))
    call.on('disconnect', () => {
      setCallStatus('disconnected')
      activeCallRef.current = null
    })
    call.on('cancel', () => setCallStatus('disconnected'))
    call.on('error', () => setCallStatus('error'))
  }

  const handleHangup = () => {
    activeCallRef.current?.disconnect()
  }

  const sendDigit = (digit: string) => {
    activeCallRef.current?.sendDigits(digit)
  }

  return { isReady, callStatus, handleCall, handleHangup, sendDigit }
}
