import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  // output: 'standalone' is used for Docker deployments; omit for Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  transpilePackages: ['@rv-trax/shared'],
  eslint: {
    // ESLint runs in CI via `pnpm lint` — don't block production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Typecheck runs in CI via `pnpm typecheck` — don't block production builds
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
