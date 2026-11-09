import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before rendering, so it can answer with real HTTP status codes:
 *
 * 1. Admin gate (optimistic): requests without a session cookie go to the
 *    login page. This is a UX shortcut, not the security boundary — every
 *    admin page and server action verifies the session and allowlist itself.
 * 2. Renamed articles: old `/blog/<slug>` URLs get a permanent 308 redirect.
 *    Pages stream, so a redirect issued during rendering would only be a
 *    client-side navigation; doing it here keeps it a proper HTTP redirect.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];
/** Short, because the map is refreshed stale-while-revalidate after each publish. */
const REDIRECTS_TTL_MS = 5_000;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let redirectCache: { map: Record<string, string>; fetchedAt: number } | null = null;

/**
 * The redirect map is fetched from the configured site URL, never from the
 * request's Host header: that header is client-controlled, and trusting it
 * would let anyone point this server-side fetch at another host and poison
 * the shared cache. Only the request origin is used as a fallback in dev.
 */
function trustedOrigin(request: NextRequest): string | null {
  // SITE_URL is read at runtime; NEXT_PUBLIC_SITE_URL is inlined at build time.
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  return process.env.NODE_ENV === "development" ? request.nextUrl.origin : null;
}

async function getRedirects(request: NextRequest): Promise<Record<string, string>> {
  if (redirectCache && Date.now() - redirectCache.fetchedAt < REDIRECTS_TTL_MS) return redirectCache.map;
  const origin = trustedOrigin(request);
  if (!origin) return {};
  try {
    const response = await fetch(`${origin}/api/content/redirects`, { cache: "no-store" });
    const raw: unknown = response.ok ? await response.json() : {};
    const map: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [from, to] of Object.entries(raw))
        if (SLUG.test(from) && typeof to === "string" && SLUG.test(to)) map[from] = to;
    }
    redirectCache = { map, fetchedAt: Date.now() };
    return map;
  } catch {
    // Never block page views on this lookup; the page-level redirect still applies.
    return redirectCache?.map ?? {};
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // Only page navigations are redirected. Server actions (POST) must reach
    // the server so they can return their own "not authorized" result.
    if (pathname === "/admin/login" || (request.method !== "GET" && request.method !== "HEAD"))
      return NextResponse.next();
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const match = /^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  if (match?.[1]) {
    const target = (await getRedirects(request))[match[1]];
    if (target && target !== match[1]) {
      const url = request.nextUrl.clone();
      url.pathname = `/blog/${target}`;
      return NextResponse.redirect(url, 308);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/blog/:slug"],
};
