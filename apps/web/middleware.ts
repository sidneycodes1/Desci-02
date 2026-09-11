import { createAuthMiddleware } from '@sciagent/auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const authMiddleware = createAuthMiddleware({ requiredRole: 'viewer' });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    try {
      await authMiddleware(request, { params: {} });
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
