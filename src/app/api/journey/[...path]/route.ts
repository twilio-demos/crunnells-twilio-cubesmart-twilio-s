import { type NextRequest } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { resolveJourneyServerUrl } from '@/lib/journey/server-url'

const base = () => resolveJourneyServerUrl()

async function forward(request: NextRequest, path: string[]) {
  const root = base()
  if (!root) {
    return Response.json(
      {
        error:
          'The journey service is not connected yet. Add the voice server address in the API Keys tab, then deploy.',
      },
      { status: 503 }
    )
  }

  const search = request.nextUrl.search
  const url = `${root}/journey/${path.join('/')}${search}`

  const init: RequestInit = {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const text = await request.text()
    init.body = text || '{}'
  }

  try {
    const upstream = await fetch(url, init)
    const body = await upstream.text()
    return new Response(body || '{}', {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return Response.json(
      { error: `Could not reach the journey service: ${(err as Error).message}` },
      { status: 502 }
    )
  }
}

export const GET = withApiHandler(async (request: NextRequest, ctx) => {
  const { path } = await (ctx as { params: Promise<{ path: string[] }> }).params
  return forward(request, path)
})

export const POST = withApiHandler(async (request: NextRequest, ctx) => {
  const { path } = await (ctx as { params: Promise<{ path: string[] }> }).params
  return forward(request, path)
})
