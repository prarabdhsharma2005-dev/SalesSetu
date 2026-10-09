import { createHmac } from 'node:crypto'
import { auth, sessionWorkspaceId } from '@/auth'
import { backendUrl } from '../../../../../backend-config'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxyBackend(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const suffix = (await context.params).path.join('/')
  if (!suffix || suffix.split('/').some(part => part === '..' || part === '.')) return Response.json({ error: 'Invalid API path.' }, { status: 400 })
  const method = request.method
  const targetPath = `/${suffix}${request.nextUrl.search}`
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  headers.set('accept', request.headers.get('accept') || 'application/json')
  const workspaceMode = process.env.GOOGLE_WORKSPACES_ENABLED === 'true'
  if (workspaceMode) {
    const session = await auth()
    const id = sessionWorkspaceId(session)
    if (!id) return Response.json({ error: 'Sign in with Google to access your workspace.' }, { status: 401 })
    const secret = process.env.INTERNAL_PROXY_SECRET || ''
    const user = process.env.APP_ACCESS_USER || ''
    const password = process.env.APP_ACCESS_PASSWORD || ''
    if (secret.length < 32 || !user || password.length < 24) return Response.json({ error: 'Workspace service access is not configured.' }, { status: 503 })
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && request.headers.get('origin') !== request.nextUrl.origin) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 })
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', secret).update(`v1\n${timestamp}\n${id}\n${method}\n${targetPath}`).digest('hex')
    headers.set('authorization', `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`)
    headers.set('x-salesetu-workspace', id)
    headers.set('x-salesetu-timestamp', timestamp)
    headers.set('x-salesetu-signature', signature)
  } else {
    const authorization = request.headers.get('authorization')
    if (authorization) headers.set('authorization', authorization)
  }
  try {
    const response = await fetch(`${backendUrl(process.env)}${targetPath}`, {
      method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(68_000),
    })
    const result = new Response(response.body, { status: response.status, headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'private, no-store',
    } })
    return result
  } catch { return Response.json({ error: 'Backend request failed.' }, { status: 502 }) }
}

export { proxyBackend as GET, proxyBackend as POST, proxyBackend as PUT, proxyBackend as PATCH, proxyBackend as DELETE }
