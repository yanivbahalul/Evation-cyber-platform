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
      process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL || 'http://localhost:3002',
    NEXT_PUBLIC_DEV_PUBLIC_HOST: process.env.DEV_PUBLIC_HOST || 'localhost',
  },
  async rewrites() {
    const gatewayOrigin =
      process.env.GATEWAY_ORIGIN || 'http://127.0.0.1:4001'
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
