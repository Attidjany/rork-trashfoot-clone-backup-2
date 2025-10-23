import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { nextUrl } = req;

  // If Supabase sent us back with a PKCE code anywhere in the app,
  // rewrite to /auth/callback so we exchange it for a session.
  const hasCode = nextUrl.searchParams.has('code');

  // Avoid loops: if we're already on /auth/callback, do nothing.
  const alreadyOnCallback = nextUrl.pathname === '/auth/callback';

  if (hasCode && !alreadyOnCallback) {
    const callbackUrl = new URL('/auth/callback', nextUrl.origin);

    // Preserve all query params (type=signup|recovery|oauth, etc.)
    nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });

    return NextResponse.rewrite(callbackUrl);
  }

  return NextResponse.next();
}

// Exclude Next.js internals and static assets from middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};