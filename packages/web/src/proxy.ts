import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: This proxy is a UX optimization for redirects only, NOT a security boundary.
// The proxy only checks cookie existence, not validity.
// ALL server actions and API route handlers MUST call requireAuth() independently.

// Trailing slash convention: use startsWith(p + "/") to avoid matching
// unintended prefixes (e.g., "/api/authorize" matching "/api/auth").
const publicPaths = ["/", "/explore", "/login", "/register", "/forgot-password", "/reset-password"];
const publicExact = ["/api/notifications/send-daily"];

// These paths are conditionally public — actual access control is at the page/action level
function isConditionallyPublicPath(pathname: string): boolean {
  return /^\/courses\/[^/]+$/.test(pathname)
    || /^\/materials\/\d+$/.test(pathname)
    || /^\/quizzes\/\d+(\/play)?$/.test(pathname)
    || /^\/decks\/\d+$/.test(pathname)
    || /^\/study\/\d+$/.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exact public paths
  if (publicExact.includes(pathname)) {
    return NextResponse.next();
  }

  // Public path prefixes (exact match or starts with path + "/")
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Better Auth catch-all route
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Conditionally public pages (access checked at page/action level)
  if (isConditionallyPublicPath(pathname)) {
    return NextResponse.next();
  }

  // UX redirect only — cookie existence check, NOT session validation.
  // Better Auth uses __Secure- prefix on HTTPS, plain name on HTTP
  const sessionToken = request.cookies.get("better-auth.session_token")
    || request.cookies.get("__Secure-better-auth.session_token");
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
