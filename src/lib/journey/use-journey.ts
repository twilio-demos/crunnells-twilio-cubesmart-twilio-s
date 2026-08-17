'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlexHealth, JourneyConfig, JourneyState, ProfileSnapshot } from './types'

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/journey/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || 'Something went wrong.')
  return data
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/journey/${path}`, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || 'Something went wrong.')
  return data
}

function wsUrl(serverUrl?: string): string | null {
  if (!serverUrl) return null
  const base = serverUrl.startsWith('http') ? serverUrl : `https://${serverUrl}`
  return `${base.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/journey`
}

export function useJourney(serverUrl?: string) {
  const [config, setConfig] = useState<JourneyConfig | null>(null)
  const [state, setState] = useState<JourneyState | null>(null)
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null)
  const [flex, setFlex] = useState<FlexHealth | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await get<{ state: JourneyState | null; profile: ProfileSnapshot }>('state')
      setState(data.state)
      setProfile(data.profile)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const cfg = await get<JourneyConfig>('config')
        if (!cancelled) {
          setConfig(cfg)
          if (cfg.flex) setFlex(cfg.flex)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
      if (!cancelled) await refresh()
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const refreshFlex = useCallback(async (force = false) => {
    try {
      const data = force
        ? await post<{ flex: FlexHealth }>('flex-check')
        : await get<{ flex: FlexHealth }>('flex')
      setFlex(data.flex)
      return data.flex
    } catch {
      return null
    }
  }, [])

  // Keep an eye on Flex through Act 4 so the handoff panel shows real task state,
  // and so the story advances the moment a real agent accepts the task.
  useEffect(() => {
    const beatId = state?.beatId
    if (beatId !== 'voice-callback' && beatId !== 'flex' && beatId !== 'save') return
    const id = setInterval(() => {
      void refreshFlex()
      void refresh()
    }, 5000)
    return () => clearInterval(id)
  }, [state?.beatId, refreshFlex, refresh])

  // Live feed
  useEffect(() => {
    const url = wsUrl(serverUrl)
    if (!url) return

    let closed = false
    let retry: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (closed) return
      let socket: WebSocket
      try {
        socket = new WebSocket(url)
      } catch {
        retry = setTimeout(connect, 4000)
        return
      }
      socketRef.current = socket

      socket.onopen = () => setConnected(true)
      socket.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(connect, 4000)
      }
      socket.onerror = () => setConnected(false)
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type: string
            state?: JourneyState | null
          }
          if (payload.type === 'journey_state') {
            setState(payload.state ?? null)
            // Memory reads are a separate API call; refresh the profile pane too.
            void get<{ profile: ProfileSnapshot }>('state')
              .then((d) => setProfile(d.profile))
              .catch(() => undefined)
          }
        } catch {
          /* ignore */
        }
      }
    }

    connect()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      socketRef.current?.close()
    }
  }, [serverUrl])

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key)
      setError(null)
      try {
        await fn()
        await refresh()
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setBusy(null)
      }
    },
    [refresh]
  )

  return {
    config,
    state,
    profile,
    flex,
    connected,
    error,
    busy,
    setError,
    refresh,
    refreshFlex,
    run,
    api: { get, post },
  }
}
