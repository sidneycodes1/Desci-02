import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { updateProfileSchema } from '../../../../lib/validation/profile';

/**
 * GET /api/user/profile - Get current user profile & wallet settings
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);
    const supabase = createSupabaseClientFromToken(token);

    const { data: user, error } = await supabase
      .from('users')
      .select('*, wallets(*)')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile: user });
  } catch (error) {
    console.error('GET /api/user/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile - Update user profile & academic credentials
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
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

    const { displayName, bio, orcidId } = validation.data;
    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };
    if (displayName !== undefined) updates.display_name = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (orcidId !== undefined) updates.orcid_id = orcidId === '' ? null : orcidId;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', session.userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: updatedUser, updatedFields: validation.data });
  } catch (error) {
    console.error('PUT /api/user/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
