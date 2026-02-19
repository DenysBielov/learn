import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "auth_token";

const PUBLIC_PATHS = ["/login", "/api/auth/"];
const STATIC_PREFIXES = ["/_next/", "/favicon.ico"];
const EXACT_PUBLIC_PATHS = ["/api/notifications/send-daily"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    EXACT_PUBLIC_PATHS.some((p) => pathname === p)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
