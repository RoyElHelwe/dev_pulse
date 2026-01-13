/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ft-trans/frontend-shared', '@dev-pulse/shared-types'],
  output: 'standalone', // Required for Docker production builds
  // Allow cross-origin requests from network IP in development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With,Content-Type,Authorization' },
        ],
      },
    ]
  },
  // Allow development access from network IPs
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      `http://${process.env.HOST_IP || 'localhost'}:3000`,
      `https://${process.env.HOST_IP || 'localhost'}:3000`,
      'http://localhost:3000',
      'https://localhost:3000',
    ],
  }),
  webpack: (config: any) => {
    // Phaser.js webpack configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      phaser: 'phaser/dist/phaser.js',
    }
    return config
  },
}

export default nextConfig
