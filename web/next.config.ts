import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/discover',
        destination: '/search',
        permanent: false,
      },
      {
        source: '/explore',
        destination: '/properties',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/properties',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
