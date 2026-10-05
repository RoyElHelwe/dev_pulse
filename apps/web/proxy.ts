import { type NextRequest, NextResponse } from 'next/server';

// Runs before a page is rendered. It only looks at the signed_in cookie
// (a hint for nicer redirects); the API still checks the real tokens.

const PROTECTED = ['/office', '/settings', '/onboarding', '/team'];
const GUEST_ONLY = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has('signed_in');

  if (!signedIn && PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(login);
  }
  // Already signed in: skip the sign-in pages (but keep OAuth error messages visible).
  if (signedIn && GUEST_ONLY.includes(pathname) && !request.nextUrl.searchParams.has('error')) {
    return NextResponse.redirect(new URL('/office', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/office/:path*', '/settings/:path*', '/onboarding', '/team', '/login', '/register'],
};
