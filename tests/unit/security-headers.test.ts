import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/config/security-headers";

describe("security headers", () => {
  it("locks down everything except inline scripts needed by static rendering", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://github.com",
      "connect-src 'self'",
      "upgrade-insecure-requests",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval and websockets only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds the analytics origin only when configured", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, analyticsSrc: "https://plausible.io/js/script.js" });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://plausible.io");
    expect(csp).toContain("connect-src 'self' https://plausible.io");
  });

  it("sends the standard hardening headers", () => {
    const names = buildSecurityHeaders({ isDev: false }).map((h) => h.key);
    expect(names).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
      ]),
    );
  });
});
