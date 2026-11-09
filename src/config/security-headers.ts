/**
 * HTTP security headers applied to every response (see SECURITY.md).
 *
 * CSP trade-off: per-request nonces would force every page to render
 * dynamically, giving up static/PPR output. InkGit keeps static rendering and
 * allows inline scripts (Next.js inlines its RSC payload), relying on the
 * safe-MDX sanitizer as the primary XSS defence. Everything else is locked
 * down: no plugins, no framing, no <base> hijacking, forms only to this site
 * and GitHub (OAuth), and network calls only to this origin (+ analytics).
 */
export interface SecurityHeaderOptions {
  isDev: boolean;
  /** Analytics script URL (NEXT_PUBLIC_ANALYTICS_SRC) when analytics is enabled. */
  analyticsSrc?: string | undefined;
}

export function buildContentSecurityPolicy({ isDev, analyticsSrc }: SecurityHeaderOptions): string {
  const analyticsOrigin = analyticsSrc ? new URL(analyticsSrc).origin : null;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...(analyticsOrigin ? [analyticsOrigin] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Articles may embed images from any https host; uploads are same-origin or the media CDN.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(analyticsOrigin ? [analyticsOrigin] : []), ...(isDev ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // The sign-in form posts to this site, which redirects to GitHub for OAuth.
    "form-action": ["'self'", "https://github.com"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Ignored by browsers over plain HTTP; enforced once served over HTTPS.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}
