import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: ['logo.clearbit.com', 'unavatar.io'],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

export default nextConfig
