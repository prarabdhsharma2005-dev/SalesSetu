import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, sessionWorkspaceId, signIn, signOut } from '@/auth'
import { serverBackendDelete } from '@/lib/server-backend'

const intentCookie = 'salesetu_delete_intent'

function signIntent(id: string, issued: number) {
  const secret = process.env.AUTH_SECRET || ''
  if (secret.length < 32) throw new Error('Account reauthentication is not configured.')
  return createHmac('sha256', secret).update(`delete-workspace:${id}:${issued}`).digest('hex')
}

async function startReauthentication() {
  'use server'
  const id = sessionWorkspaceId(await auth())
  if (!id) redirect('/signin')
  const issued = Date.now()
  ;(await cookies()).set(intentCookie, `${id}.${issued}.${signIntent(id, issued)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  })
  await signIn('google', { redirectTo: '/settings/account?reauth=complete' }, { prompt: 'select_account' })
}

async function deleteAccount(formData: FormData) {
  'use server'
  const session = await auth()
  const id = sessionWorkspaceId(session)
  if (!id) redirect('/signin')
  if (formData.get('confirmation') !== 'DELETE MY WORKSPACE') redirect('/settings/account?error=confirmation')
  const value = (await cookies()).get(intentCookie)?.value || ''
  const [owner, issuedRaw, suppliedRaw] = value.split('.')
  const issued = Number(issuedRaw)
  const reauthAt = (session as typeof session & { reauthAt?: number })?.reauthAt
  if (owner !== id || !Number.isSafeInteger(issued) || issued > Date.now() || Date.now() - issued > 5 * 60_000 || !Number.isSafeInteger(reauthAt) || reauthAt! < issued) redirect('/settings/account?error=reauth')
  const expected = Buffer.from(signIntent(id, issued), 'hex')
  const supplied = Buffer.from(suppliedRaw || '', 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) redirect('/settings/account?error=reauth')
  const response = await serverBackendDelete('/api/account')
  if (!response.ok) redirect('/settings/account?error=storage')
  ;(await cookies()).delete(intentCookie)
  await signOut({ redirectTo: '/' })
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; reauth?: string }> }) {
  if (process.env.GOOGLE_WORKSPACES_ENABLED !== 'true') redirect('/settings')
  const session = await auth()
  if (!sessionWorkspaceId(session)) redirect('/signin')
  const params = await searchParams
  return <div style={{ maxWidth: 620, display: 'grid', gap: 20 }}>
    <Link href="/settings" style={{ color: 'var(--blue-light)' }}>← Settings</Link>
    <h1 style={{ color: 'var(--text-1)', fontSize: 30 }}>Your account</h1>
    <p style={{ color: 'var(--text-3)' }}>Signed in as {session?.user?.email || 'your Google account'}.</p>
    <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}><button type="submit" style={{ padding: 11, borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border)', cursor: 'pointer' }}>Sign out</button></form>
    <section style={{ padding: 24, borderRadius: 13, border: '1px solid var(--danger)', background: 'var(--bg-card)' }}>
      <h2 style={{ color: 'var(--text-1)', fontSize: 20 }}>Delete this workspace</h2>
      <p style={{ color: 'var(--text-3)', margin: '10px 0' }}>This permanently removes your saved leads, drafts, approvals, meetings, pipeline records, audit data, Gmail connection, and usage counters. It does not affect other accounts. Revoke SalesSetu access in your Google account separately if desired.</p>
      {params.error && <p role="alert" style={{ color: 'var(--danger)' }}>Could not delete the workspace. {params.error === 'reauth' ? 'Reauthenticate with Google again.' : params.error === 'confirmation' ? 'Type the confirmation phrase exactly.' : 'Storage is unavailable; no other workspace was changed.'}</p>}
      <form action={startReauthentication}><button type="submit" style={{ padding: 11, borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border)', cursor: 'pointer' }}>Reauthenticate with Google</button></form>
      {params.reauth === 'complete' && <form action={deleteAccount} style={{ display: 'grid', gap: 10, marginTop: 18 }}><label htmlFor="confirmation">Type DELETE MY WORKSPACE to confirm</label><input id="confirmation" name="confirmation" autoComplete="off" style={{ padding: 11, background: 'var(--bg-input)', color: 'var(--text-1)', border: '1px solid var(--border)' }}/><button type="submit" style={{ padding: 11, borderRadius: 8, background: 'var(--danger)', color: 'white', border: 0, cursor: 'pointer' }}>Permanently delete my workspace</button></form>}
    </section>
  </div>
}
