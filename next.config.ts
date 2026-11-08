import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally OFF: public pages use ISR + on-demand
  // revalidation so that notFound()/permanentRedirect() always produce real
  // 404/308 status codes (no streamed soft-404s). See docs/ARCHITECTURE.md.
  cacheComponents: false,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pg", "nodemailer"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: process.env.MEDIA_PUBLIC_HOST
      ? [{ protocol: "https", hostname: process.env.MEDIA_PUBLIC_HOST }]
      : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
