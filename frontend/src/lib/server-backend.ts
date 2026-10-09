import 'server-only'
import { createHmac } from 'node:crypto'
import { auth, sessionWorkspaceId } from '@/auth'
import { backendUrl } from '../../backend-config'

/** Authenticated server component reads use the same internal assertion as the API proxy. */
async function serverBackendRequest(path: string, method: 'GET' | 'DELETE'): Promise<Response> {
  if (!/^\/api\/[a-z0-9/_-]+$/i.test(path)) throw new Error('Invalid backend path.')
  const headers = new Headers({ accept: 'application/json' })
  if (process.env.GOOGLE_WORKSPACES_ENABLED === 'true') {
    const workspace = sessionWorkspaceId(await auth())
    const secret = process.env.INTERNAL_PROXY_SECRET || ''
    const user = process.env.APP_ACCESS_USER || ''
    const password = process.env.APP_ACCESS_PASSWORD || ''
    if (!workspace || secret.length < 32 || !user || password.length < 24) throw new Error('Authenticated workspace service access is unavailable.')
    const timestamp = String(Date.now())
    headers.set('authorization', `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`)
    headers.set('x-salesetu-workspace', workspace)
    headers.set('x-salesetu-timestamp', timestamp)
    headers.set('x-salesetu-signature', createHmac('sha256', secret).update(`v1\n${timestamp}\n${workspace}\n${method}\n${path}`).digest('hex'))
  } else if (process.env.APP_ACCESS_USER && process.env.APP_ACCESS_PASSWORD) {
    headers.set('authorization', `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`)
  }
  return fetch(`${backendUrl(process.env)}${path}`, { method, headers, cache: 'no-store', signal: AbortSignal.timeout(68_000) })
}
export const serverBackendGet = (path: string) => serverBackendRequest(path, 'GET')
export const serverBackendDelete = (path: string) => serverBackendRequest(path, 'DELETE')
