import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge middleware must NOT import Node-only modules (Privy / hpke / crypto).
// Previous version imported verifySession from @sciagent/auth/session which
// pulls PrivyClient -> hpke/common -> Node crypto, crashing the Edge build
// (3221225794). Next.js middleware always runs on the Edge Runtime and cannot
// be switched to Node (see https://nextjs.org/docs/app/api-reference/edge).
// This middleware now does only a lightweight presence check (is there a
// Bearer token?). Full cryptographic verification happens in each API route via
// requireAppSession -> getAppIdentity -> PrivyClient.verifyAuthToken,
// which runs on the Node runtime (default for API routes, none have
// runtime = edge). Every apps/web/app/api/**/route.ts already calls
// requireAppSession, so no route loses protection.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token || token === 'null' || token === 'undefined' || token === '') {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
