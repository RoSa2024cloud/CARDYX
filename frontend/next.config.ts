import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const internalApiUrl = process.env.CARDYX_INTERNAL_API_URL ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${internalApiUrl}/api/:path*` }];
  },
};

export default nextConfig;
