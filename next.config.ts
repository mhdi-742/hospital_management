import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: '/billing',
      destination: '/billing/index.html',
    },
  ],
};

export default nextConfig;
