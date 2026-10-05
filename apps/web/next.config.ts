import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a small self-contained server for the production Docker image.
  output: 'standalone',
  // Extra hosts allowed to load dev assets (e.g. your LAN IP), comma separated.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(',').filter(Boolean),
};

export default nextConfig;
