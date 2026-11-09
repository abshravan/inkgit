import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for the admin area: redirect visitors without a session
 * cookie to the login page. This is a UX shortcut, not the security boundary —
 * every admin page and server action verifies the session and allowlist
 * itself (see modules/auth/guards.ts).
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

export const config = {
  matcher: ["/admin/:path*"],
};
