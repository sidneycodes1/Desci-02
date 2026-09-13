import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@sciagent/auth/session';
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const preferences = getUserNotificationPreferences(session.userId);
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const body = await request.json();
    const validation = notificationPreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updatedPreferences = updateUserNotificationPreferences(session.userId, validation.data);

    return NextResponse.json({ preferences: updatedPreferences });
  } catch (error) {
    console.error('PUT /api/user/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
