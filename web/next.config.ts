import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/discover',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/explore',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/map',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/properties',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/alerts',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
