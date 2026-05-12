/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// CSP — Next.js 14 needs unsafe-inline for inline runtime scripts and Tailwind styles.
// connect-src includes Sentry endpoints when DSN is configured.
const cspProd = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Content-Security-Policy", value: cspProd },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  // standalone output: bundles only the files needed for production into .next/standalone.
  // Used by Dockerfile to produce a ~150MB image instead of pulling all of node_modules.
  output: "standalone",
  experimental: { serverComponentsExternalPackages: ["better-sqlite3", "pdfjs-dist"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

let exportedConfig = nextConfig;

// Only wrap with Sentry when a DSN is present — keeps dev startup snappy
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const { withSentryConfig } = require("@sentry/nextjs");
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      // Org/project come from SENTRY_ORG / SENTRY_PROJECT env vars
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch (e) {
    console.warn("[next.config] @sentry/nextjs failed to load — running without it");
  }
}

module.exports = exportedConfig;
