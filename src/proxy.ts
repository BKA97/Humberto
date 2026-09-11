import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (function `proxy`, not
// `middleware`) and it now always runs on the Node.js runtime, which is why
// this can safely use the Node `crypto`-based session check in lib/auth.ts.
//
// This is a private, single-user research journal (spec §33) — a signed
// session cookie behind one shared password is enough; there's no
// multi-user/account model to build.

export const config = {
  matcher: ["/((?!api/cron|api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
