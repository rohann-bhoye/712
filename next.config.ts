import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import dns from "dns";

if (process.platform === "win32") {
  try {
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
  } catch (e) {
    console.warn("Could not set Google DNS servers:", e);
  }
}

const nextConfig: NextConfig = {
  // Expose app version to client components
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
  },

  // Production security headers applied to every response
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
        ]
      }
    ];
  }
};

// Wrap with Sentry to enable automatic error capture + source map upload
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry build output in dev
  silent: process.env.NODE_ENV !== 'production',

  // Upload source maps only in production builds
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production'
  },

  // Automatically instrument Next.js API routes and server components
  autoInstrumentServerFunctions: true
});
