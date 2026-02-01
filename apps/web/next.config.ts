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
  // Allow development access from network IPs - include all possible origins
  allowedDevOrigins: [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://10.12.4.9:3000',
    'https://10.12.4.9:3000',
    '10.12.4.9',
  ],
  webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
    // Phaser.js webpack configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      phaser: 'phaser/dist/phaser.js',
    }
    
    return config
  },
}

export default nextConfig
