import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/auth/login") {
    return NextResponse.redirect(new URL(`/signin${search}`, request.url));
  }
  if (pathname === "/auth/signup") {
    return NextResponse.redirect(new URL(`/signup${search}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/login", "/auth/signup"],
};
