import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://*.razorpay.in https://*.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://res.cloudinary.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com https://*.razorpay.in https:; connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://*.razorpay.in https://api.postalpincode.in https://api.cloudinary.com https://*.sentry.io https://*.vercel-scripts.com;"
          }
        ],
      }
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "placeholder-org",
  project: process.env.SENTRY_PROJECT || "rentpe-nextjs",

  silent: true,

  // Disable source map uploads unless SENTRY_AUTH_TOKEN is configured
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  disableLogger: true,

  // Only enable advanced features when auth token is present
  ...(process.env.SENTRY_AUTH_TOKEN ? {
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    automaticVercelMonitors: true,
  } : {}),
});
