import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@sciagent/auth/session';
import { listUserNotifications } from '@sciagent/shared/services/notificationService';

/**
 * GET /api/notifications - List notifications for logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const notifications = listUserNotifications(session.userId);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
