import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@rv-trax/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
