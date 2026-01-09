/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ft-trans/frontend-shared', '@dev-pulse/shared-types'],
  output: 'standalone', // Required for Docker production builds
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
