import type { NextConfig } from 'next'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'unavatar.io' },
    ],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  devIndicators: false,

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
