// Loaded before tests and dotenv/config. Never let a local .env send test traffic to live services.
for (const key of [
  'DATABASE_URL', 'GOOGLE_SHEETS_WEBHOOK_URL', 'GOOGLE_SHEET_ID',
  'GEMINI_API_KEY', 'TAVILY_API_KEY',
  'GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_OAUTH_REDIRECT_URI', 'GMAIL_TOKEN_ENCRYPTION_KEY',
]) process.env[key] = ''
process.env.FOLLOW_UP_SCHEDULER_ENABLED = 'false'
process.env.NODE_ENV = 'test'
// One extraction test checks the configured branch while stubbing generation.
process.env.GEMINI_API_KEY = 'isolated-test-key'
const originalFetch = global.fetch
global.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return originalFetch(input, options)
  return Promise.reject(new Error('External network is disabled during isolated tests.'))
}
