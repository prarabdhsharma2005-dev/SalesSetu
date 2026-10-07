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

  // Proxy all /api/backend/* calls to the Express backend.
  // This eliminates CORS issues and avoids hard-coding the port in client code.
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
