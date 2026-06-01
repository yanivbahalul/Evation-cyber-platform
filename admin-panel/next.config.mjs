import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })
require('./scripts/applyDevPublicHost.cjs').applyDevPublicHost()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_TELEMETRY_SOCKET_URL:
      process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL || '',
    NEXT_PUBLIC_DEV_PUBLIC_HOST: process.env.DEV_PUBLIC_HOST || '',
  },
  async rewrites() {
    // NOTE: rewrites are evaluated at build time.
    // In Docker builds we usually don't have runtime env available, so default to the
    // docker-compose service hostname in production builds.
    const gatewayOrigin =
      process.env.GATEWAY_ORIGIN ||
      (process.env.NODE_ENV === 'production' ? 'http://gateway:4001' : 'http://127.0.0.1:4001')
    const gatewayBase = (process.env.GATEWAY_BASE_PATH || '/gateway').replace(/\/$/, '')
    return [
      {
        source: '/gateway/',
        destination: `${gatewayOrigin}${gatewayBase}/`,
      },
      {
        source: '/gateway/:path+',
        destination: `${gatewayOrigin}${gatewayBase}/:path+`,
      },
      {
        source: '/gateway',
        destination: `${gatewayOrigin}${gatewayBase}/`,
      },
    ]
  },
}

export default nextConfig
