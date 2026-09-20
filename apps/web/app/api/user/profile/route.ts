import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '../../../../lib/app-session';
import { updateProfileSchema } from '../../../../lib/validation/profile';

/**
 * GET /api/user/profile - Get current user profile & wallet settings
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;
    const supabase = session.supabase;

    const { data: user, error } = await supabase
      .from('users')
      .select('*, wallets(*)')
      .eq('id', session.appUserId)
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
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

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
      .eq('id', session.appUserId)
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
