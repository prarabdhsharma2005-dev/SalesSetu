export function backendUrl(env: Record<string, string | undefined>) {
  const configured = env.BACKEND_URL || env.NEXT_PUBLIC_BACKEND_URL
  if (env.NODE_ENV === 'production' && !configured) throw new Error('Production requires BACKEND_URL.')
  const url = new URL(configured || 'http://localhost:5000')
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol)) throw new Error('BACKEND_URL must be an origin without credentials, path or query.')
  if (env.NODE_ENV === 'production' && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Production BACKEND_URL must be a public HTTPS origin.')
  return url.origin
}
