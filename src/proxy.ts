import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdmin = req.auth?.user?.isAdmin;

  if (isAdminRoute && !isAdmin) {
    const loginUrl = new URL("/login", origin);
    return NextResponse.redirect(loginUrl);
  }

  const user = req.auth?.user as { id?: string; isAdmin?: boolean } | undefined;

  if (pathname.startsWith("/conta") && !user?.id) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/admin/:path*", "/conta/:path*"],
};
