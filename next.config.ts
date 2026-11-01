import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's Next.js adapter consumes the standard .next build output.
  outputFileTracingIncludes: {
    '/api/generate-infographic': ['./public/fonts/**/*.ttf'],
    '/api/export-all': ['./public/fonts/**/*.ttf'],
    '/api/export-pdf': ['./public/fonts/**/*.ttf'],
  },
  reactStrictMode: false,
};

export default nextConfig;
