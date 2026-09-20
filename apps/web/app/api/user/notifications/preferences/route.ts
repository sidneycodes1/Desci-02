import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '../../../../../lib/app-session';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@sciagent/shared/services/notificationService';
import { notificationPreferencesSchema } from '../../../../../lib/validation/settings';

/**
 * GET /api/user/notifications/preferences - Fetch user notification settings
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const preferences = getUserNotificationPreferences(session.appUserId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('GET /api/user/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/notifications/preferences - Update user notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validation = notificationPreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updatedPreferences = updateUserNotificationPreferences(session.appUserId, validation.data);

    return NextResponse.json({ preferences: updatedPreferences });
  } catch (error) {
    console.error('PUT /api/user/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
