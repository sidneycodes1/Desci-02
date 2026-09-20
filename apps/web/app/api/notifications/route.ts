import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '../../../lib/app-session';
import { listUserNotifications } from '@sciagent/shared/services/notificationService';

/**
 * GET /api/notifications - List notifications for logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const notifications = listUserNotifications(session.appUserId);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
