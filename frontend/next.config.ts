import type { NextConfig } from 'next'
import { backendUrl } from './backend-config'

const BACKEND_URL = backendUrl(process.env)

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'unavatar.io' },
    ],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  devIndicators: false,
  experimental: {
    proxyTimeout: 70_000,
  },

  // Legacy mode rewrites directly; workspace mode uses the authenticated app route.
  async rewrites() {
    if (process.env.GOOGLE_WORKSPACES_ENABLED === 'true') return []
    return [
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
