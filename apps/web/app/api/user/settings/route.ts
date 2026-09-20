import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '../../../../lib/app-session';
import { userSettingsSchema } from '../../../../lib/validation/settings';

/**
 * GET /api/user/settings - Fetch authenticated user settings & linked wallets
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

    return NextResponse.json({ settings: user });
  } catch (error) {
    console.error('GET /api/user/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/settings - Update user display profile & wallet options
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validation = userSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    const { displayName, bio, orcidId, primaryWalletAddress } = validation.data;
    const updates: Record<string, string | null> = {
      display_name: displayName,
      updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) updates.bio = bio;
    if (orcidId !== undefined) updates.orcid_id = orcidId === '' ? null : orcidId;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', session.appUserId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user settings:', error);
      return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 });
    }

    if (primaryWalletAddress !== undefined) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('address', primaryWalletAddress)
        .single();

      if (!wallet || wallet.user_id !== session.appUserId) {
        return NextResponse.json({ error: 'Wallet not found for this user' }, { status: 404 });
      }

      const { error: walletError } = await supabase
        .from('wallets')
        .update({ is_primary: false })
        .eq('user_id', session.appUserId);

      if (walletError) {
        console.error('Error clearing primary wallets:', walletError);
        return NextResponse.json({ error: 'Failed to update wallet settings' }, { status: 500 });
      }

      const { error: primaryError } = await supabase
        .from('wallets')
        .update({ is_primary: true })
        .eq('user_id', session.appUserId)
        .eq('address', primaryWalletAddress);

      if (primaryError) {
        console.error('Error setting primary wallet:', primaryError);
        return NextResponse.json({ error: 'Failed to update wallet settings' }, { status: 500 });
      }
    }

    return NextResponse.json({ settings: updatedUser });
  } catch (error) {
    console.error('PUT /api/user/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
