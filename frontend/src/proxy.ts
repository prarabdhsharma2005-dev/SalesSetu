import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

export function proxy(request: NextRequest) {
  const user = process.env.APP_ACCESS_USER
  const password = process.env.APP_ACCESS_PASSWORD
  if (process.env.NODE_ENV !== 'production' && !user && !password) return NextResponse.next()
  if (!user || !password || password.length < 24) return new NextResponse('Application access is not configured.', { status: 503 })
  const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`)
  const supplied = Buffer.from(request.headers.get('authorization') || '')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return new NextResponse('Authentication required.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="SalesSetu", charset="UTF-8"', 'Cache-Control': 'no-store' } })
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) return new NextResponse('Request origin is not allowed.', { status: 403 })
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = { matcher: '/:path*' }
