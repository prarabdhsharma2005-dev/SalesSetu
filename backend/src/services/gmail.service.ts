import 'dotenv/config'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { consumeOAuthState, deleteEncryptedGmailToken, readEncryptedGmailToken, saveOAuthState, usesPostgres, writeEncryptedGmailToken } from './postgres-store.service'

const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const pendingStates = new Map<string, { owner: string; expiresAt: number }>()
type Tokens = { accessToken: string; refreshToken: string; expiresAt: number; senderEmail: string; owner: string }
type Config = { clientId: string; clientSecret: string; redirectUri: string; key: Buffer }

export class GmailError extends Error {
  constructor(message: string, readonly ambiguous = false, readonly status = 503) { super(message) }
}

function config(): Config {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI?.trim()
  const encodedKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim()
  const key = encodedKey ? Buffer.from(encodedKey, 'base64') : Buffer.alloc(0)
  if (!clientId || !clientSecret || !redirectUri || key.length !== 32) throw new GmailError('Gmail OAuth is not configured. Set client credentials, redirect URI, and a 32-byte token encryption key.')
  const redirect = new URL(redirectUri)
  if (redirect.pathname !== '/api/gmail/oauth/callback' || redirect.search || redirect.hash || (process.env.NODE_ENV === 'production' && redirect.protocol !== 'https:')) throw new GmailError('Gmail OAuth redirect URI is invalid.')
  return { clientId, clientSecret, redirectUri, key }
}

function tokenPath() {
  return path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'gmail_oauth.enc')
}

function owner() { return process.env.APP_ACCESS_USER || 'local-single-owner' }

async function readTokens(cfg: Config): Promise<Tokens | null> {
  const envelope = usesPostgres() ? await readEncryptedGmailToken(owner()) : null
  const file = tokenPath()
  if (!usesPostgres() && !fs.existsSync(file)) return null
  if (usesPostgres() && !envelope) return null
  try {
    const stored = JSON.parse(usesPostgres() ? envelope! : fs.readFileSync(file, 'utf8')) as { iv: string; tag: string; ciphertext: string }
    const decipher = createDecipheriv('aes-256-gcm', cfg.key, Buffer.from(stored.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'))
    const tokens = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.ciphertext, 'base64')), decipher.final()]).toString('utf8')) as Tokens
    if (tokens.owner !== owner() || !tokens.refreshToken || !tokens.senderEmail) throw new Error('invalid token record')
    return tokens
  } catch { throw new GmailError('Encrypted Gmail connection could not be read. Check the token key and durable store.') }
}

async function writeTokens(cfg: Config, tokens: Tokens) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cfg.key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  const envelope = JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') })
  if (usesPostgres()) return writeEncryptedGmailToken(owner(), envelope)
  const file = tokenPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, envelope, { mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
}

async function tokenRequest(params: URLSearchParams) {
  let response: Response
  try { response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: AbortSignal.timeout(15_000) }) }
  catch { throw new GmailError('Google OAuth token request did not complete.') }
  if (!response.ok) throw new GmailError(`Google OAuth rejected the token request (HTTP ${response.status}).`)
  return await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }
}

export class GmailService {
  static async status() {
    try {
      const cfg = config()
      const tokens = await readTokens(cfg)
      return { configured: true, connected: Boolean(tokens), senderEmail: tokens?.senderEmail || null }
    } catch (error) {
      return { configured: false, connected: false, senderEmail: null, error: error instanceof Error ? error.message : 'Gmail connection is unavailable.' }
    }
  }

  static async authorizationUrl() {
    const cfg = config()
    const state = randomBytes(32).toString('base64url')
    if (usesPostgres()) await saveOAuthState(createHash('sha256').update(state).digest('hex'), owner(), new Date(Date.now() + 10 * 60_000))
    else pendingStates.set(state, { owner: owner(), expiresAt: Date.now() + 10 * 60_000 })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: 'code', scope: `openid email ${SEND_SCOPE}`, access_type: 'offline', prompt: 'consent', state }).toString()
    return url.toString()
  }

  static async completeAuthorization(state: unknown, code: unknown) {
    const valid = typeof state === 'string' && (usesPostgres()
      ? await consumeOAuthState(createHash('sha256').update(state).digest('hex'), owner())
      : (() => { const pending = pendingStates.get(state); pendingStates.delete(state); return Boolean(pending && pending.expiresAt >= Date.now() && pending.owner === owner()) })())
    if (!valid || typeof code !== 'string' || !code) throw new GmailError('Gmail authorization state is invalid or expired.', false, 400)
    const cfg = config()
    const result = await tokenRequest(new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: 'authorization_code' }))
    if (!result.access_token || !result.refresh_token || !result.scope?.split(' ').includes(SEND_SCOPE)) throw new GmailError('Gmail send permission or offline access was not granted.')
    let response: Response
    try { response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${result.access_token}` }, signal: AbortSignal.timeout(15_000) }) }
    catch { throw new GmailError('Google account identity could not be confirmed.') }
    if (!response.ok) throw new GmailError('Google account identity could not be confirmed.')
    const identity = await response.json() as { email?: string; email_verified?: boolean }
    if (!identity.email || identity.email_verified !== true) throw new GmailError('Google did not confirm a verified sender email.')
    await writeTokens(cfg, { accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + Math.max(60, result.expires_in || 3600) * 1000, senderEmail: identity.email, owner: owner() })
    return identity.email
  }

  static async disconnect() {
    const cfg = config()
    const tokens = await readTokens(cfg)
    if (!tokens) return { disconnected: true, revoked: true }
    let revoked = false
    try {
      const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.refreshToken }), signal: AbortSignal.timeout(10_000) })
      revoked = response.ok
    } catch { /* Local credentials are still removed. */ }
    if (usesPostgres()) await deleteEncryptedGmailToken(owner())
    else fs.unlinkSync(tokenPath())
    return { disconnected: true, revoked }
  }

  private static async accessToken() {
    const cfg = config()
    const tokens = await readTokens(cfg)
    if (!tokens) throw new GmailError('Connect Gmail before sending.', false, 409)
    if (tokens.expiresAt > Date.now() + 60_000) return tokens
    const fresh = await tokenRequest(new URLSearchParams({ refresh_token: tokens.refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token' }))
    if (!fresh.access_token) throw new GmailError('Gmail authorization expired. Reconnect Gmail.')
    const updated = { ...tokens, accessToken: fresh.access_token, expiresAt: Date.now() + Math.max(60, fresh.expires_in || 3600) * 1000 }
    await writeTokens(cfg, updated)
    return updated
  }

  static async send(input: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string }) {
    const tokens = await this.accessToken()
    const sender = tokens.senderEmail
    if (![sender, input.to].every(value => /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value))) throw new GmailError('Sender or recipient email is invalid.', false, 400)
    if (!input.subject.trim() || !input.body.trim()) throw new GmailError('Approved subject and body are required.', false, 400)
    const rfcMessageId = `<${randomUUID()}@${sender.split('@')[1]}>`
    const header = [
      `From: <${sender}>`, `To: <${input.to}>`, `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
      `Message-ID: ${rfcMessageId}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64',
      ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    ]
    const body = Buffer.from(input.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || ''
    const raw = Buffer.from(`${header.join('\r\n')}\r\n\r\n${body}\r\n`, 'utf8').toString('base64url')
    let response: Response
    try { response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }), signal: AbortSignal.timeout(25_000) }) }
    catch { throw new GmailError('Gmail send outcome is unknown. Do not retry until the mailbox is checked.', true) }
    if (!response.ok) throw new GmailError(response.status >= 500 ? 'Gmail send outcome is unknown. Check the mailbox before retrying.' : `Gmail rejected the message (HTTP ${response.status}).`, response.status >= 500, response.status)
    let sent: { id?: string; threadId?: string }
    try { sent = await response.json() as { id?: string; threadId?: string } }
    catch { throw new GmailError('Gmail returned an unreadable send confirmation. Check the mailbox before retrying.', true) }
    if (!sent.id || !sent.threadId) throw new GmailError('Gmail send confirmation lacked message identifiers. Check the mailbox before retrying.', true)
    return { gmailMessageId: sent.id, gmailThreadId: sent.threadId, rfcMessageId, senderEmail: sender }
  }
}
