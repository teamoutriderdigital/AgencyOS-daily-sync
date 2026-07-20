import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Shared-password gate for the internal boards. The matcher below lists ONLY the
// internal routes, so /submit (the public topic form), /login, /api, and static
// assets are never matched and stay public.
//
// A browser is "unlocked" once it holds a `site_auth` cookie equal to the
// SITE_PASSWORD env var (set by /login after a correct password). If SITE_PASSWORD
// is not configured, the gate is inert (fail-open) so a missing env var can't lock
// the whole team out — set it in Vercel to actually turn protection on.
export function middleware(req: NextRequest) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return NextResponse.next();

  if (req.cookies.get("site_auth")?.value === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/daily/:path*", "/weekly/:path*", "/rocks/:path*", "/admin/:path*"]
};
