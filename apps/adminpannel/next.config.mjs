/** @type {import('next').NextConfig} */
const nextConfig = {
  // Match Express gateway URLs (/gateway/...) — avoids redirect loop with the proxy.
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const gatewayOrigin =
      process.env.GATEWAY_ORIGIN || 'http://localhost:4001'
    // Gateway listens with BASE_PATH=/gateway — keep prefix in the proxy target.
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
