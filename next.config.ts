import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's Next.js adapter consumes the standard .next build output.
  outputFileTracingIncludes: {
    '/api/generate-infographic': ['./public/fonts/**/*.ttf', './node_modules/@sparticuz/chromium/bin/**/*', './node_modules/@sparticuz/chromium/build/**/*'],
    '/api/export-all': ['./public/fonts/**/*.ttf', './node_modules/@sparticuz/chromium/bin/**/*', './node_modules/@sparticuz/chromium/build/**/*'],
    '/api/export-pdf': ['./public/fonts/**/*.ttf', './node_modules/@sparticuz/chromium/bin/**/*', './node_modules/@sparticuz/chromium/build/**/*'],
  },
  reactStrictMode: false,
};

export default nextConfig;
