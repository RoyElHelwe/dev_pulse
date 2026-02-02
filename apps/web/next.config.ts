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
  // Get the HOST_IP from environment variable
  allowedDevOrigins: [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    `http://${process.env.HOST_IP || '10.12.1.7'}:3000`,
    `https://${process.env.HOST_IP || '10.12.1.7'}:3000`,
    process.env.HOST_IP || '10.12.1.7',
  ],
  webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
    // Phaser.js webpack configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      phaser: 'phaser/dist/phaser.js',
    }

    // Optimize file watching for Docker bind mounts
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        // Use polling in Docker (set via WATCHPACK_POLLING env var)
        poll: process.env.WATCHPACK_POLLING ? 300 : false,
        // Debounce to batch file changes
        aggregateTimeout: 200,
        // Ignore node_modules and build outputs
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
        ],
      }
    }
    
    return config
  },
}

export default nextConfig
