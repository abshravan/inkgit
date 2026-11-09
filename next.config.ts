import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isDev: process.env.NODE_ENV === "development",
          analyticsSrc: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN
            ? (process.env.NEXT_PUBLIC_ANALYTICS_SRC ?? "https://plausible.io/js/script.js")
            : undefined,
        }),
      },
    ];
  },
};

export default nextConfig;
