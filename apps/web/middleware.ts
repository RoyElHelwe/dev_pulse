import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = ['/', '/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Allow public routes
  const isPublicRoute = publicRoutes.includes(pathname)

  // Check for session token and refresh token
  const sessionToken = request.cookies.get('session_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value

  // If on public route and authenticated, redirect to dashboard
  if (isPublicRoute && sessionToken && pathname !== '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If on protected route and not authenticated (no session AND no refresh token), redirect to login
  if (!isPublicRoute && !sessionToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If no session token but has refresh token, allow through - frontend will refresh
  // This allows the app to call /auth/refresh to get a new session token

  return NextResponse.next()
}

// Next.js 16+ config - simpler matcher
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, other static files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
  ],
}
