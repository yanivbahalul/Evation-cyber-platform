/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const gatewayOrigin =
      process.env.GATEWAY_ORIGIN || 'http://localhost:4001'
    return [
      {
        source: '/gateway/:path*',
        destination: `${gatewayOrigin}/:path*`,
      },
    ]
  },
}

export default nextConfig
