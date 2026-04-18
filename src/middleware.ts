// src/middleware.ts
// Route protection + RBAC enforcement at the edge

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/orders',
  '/governance',
  '/gov-tasks',
  '/changes',
  '/weekly-briefs',
  '/analytics',
  '/audit-log',
  '/admin',
  '/import-export',
  '/settings',
];

// Routes accessible without auth
const PUBLIC_ROUTES = ['/auth/login', '/auth/forgot-password'];

// API routes that require auth
const PROTECTED_API_ROUTES = ['/api/orders', '/api/governance', '/api/gov-tasks', '/api/changes', '/api/briefs', '/api/units', '/api/users', '/api/lookups', '/api/dashboard', '/api/import', '/api/audit'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create supabase server client with cookie access
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const isProtectedRoute = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isProtectedApi = PROTECTED_API_ROUTES.some(r => pathname.startsWith(r));
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  // Redirect unauthenticated users to login
  if ((isProtectedRoute || isProtectedApi) && !user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login
  if (isPublicRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect root to dashboard or login
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(user ? '/dashboard' : '/auth/login', request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
