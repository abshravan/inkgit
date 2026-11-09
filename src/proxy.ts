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

let redirectCache: { map: Record<string, string>; fetchedAt: number } | null = null;

async function getRedirects(origin: string): Promise<Record<string, string>> {
  if (redirectCache && Date.now() - redirectCache.fetchedAt < REDIRECTS_TTL_MS) return redirectCache.map;
  try {
    const response = await fetch(`${origin}/api/content/redirects`, { cache: "no-store" });
    const map = response.ok ? ((await response.json()) as Record<string, string>) : {};
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
    if (pathname === "/admin/login") return NextResponse.next();
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
    const target = (await getRedirects(request.nextUrl.origin))[match[1]];
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
