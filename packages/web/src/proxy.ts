import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: This proxy is a UX optimization for redirects only, NOT a security boundary.
// The proxy only checks cookie existence, not validity.
// ALL server actions and API route handlers MUST call requireAuth() independently.

// Trailing slash convention: use startsWith(p + "/") to avoid matching
// unintended prefixes (e.g., "/api/authorize" matching "/api/auth").
const publicPaths = ["/", "/explore", "/login", "/register"];
const publicExact = ["/api/notifications/send-daily"];

// Course pages are conditionally public (checked at page level)
function isCourseViewPath(pathname: string): boolean {
  return /^\/courses\/[^/]+$/.test(pathname);
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

  // Course view pages (exact match only, not sub-paths like /study)
  if (isCourseViewPath(pathname)) {
    return NextResponse.next();
  }

  // UX redirect only — cookie existence check, NOT session validation.
  const sessionToken = request.cookies.get("better-auth.session_token");
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
