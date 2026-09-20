import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../lib/app-session';
import { respondInviteSchema } from '../../../../lib/validation/funding';

/**
 * POST /api/invites/[token] — { action: 'accept' | 'decline' }.
 * Accept resolves into a `project_collaborators` row (existing table —
 * no backfill risk). Targeted invites accept by the invitee only;
 * link invites (no invitee_id) accept by any authenticated wallet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = respondInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: invite } = await supabase.from('invites').select('*').eq('token', token).single();
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: `Invite already ${invite.status}` }, { status: 400 });
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await supabase.from('invites').update({ status: 'expired' }).eq('id', invite.id);
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }
    if (invite.invitee_id && invite.invitee_id !== appUserId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (parsed.data.action === 'decline') {
      await supabase.from('invites').update({ status: 'declined' }).eq('id', invite.id);
      return NextResponse.json({ invite: { ...invite, status: 'declined' } });
    }

    // Accept: project invites grant collaborator membership;
    // article invites grant article editorship (plan §05).
    if (invite.entity_type === 'article') {
      const { data: existing } = await supabase
        .from('article_collaborators')
        .select('*')
        .eq('article_id', invite.entity_id)
        .eq('user_id', appUserId)
        .single();
      if (!existing) {
        const { error } = await supabase.from('article_collaborators').insert({
          id: crypto.randomUUID(),
          article_id: invite.entity_id,
          user_id: appUserId,
          invited_by: invite.inviter_id,
        });
        if (error) {
          console.error('Error adding article collaborator from invite:', error);
          return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
        }
      }
    } else if (invite.entity_type === 'project') {
      const { data: existing } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', invite.entity_id)
        .eq('user_id', appUserId)
        .single();
      if (!existing) {
        const { error } = await supabase.from('project_collaborators').insert({
          project_id: invite.entity_id,
          user_id: appUserId,
          role: 'collaborator',
        });
        if (error) {
          console.error('Error adding collaborator from invite:', error);
          return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
        }
      }
    }
    const { data: updated } = await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)
      .select()
      .single();
    return NextResponse.json({ invite: updated ?? { ...invite, status: 'accepted' } });
  } catch (error) {
    console.error('POST /api/invites/[token] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
