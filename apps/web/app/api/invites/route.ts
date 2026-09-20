import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../lib/app-session';
import { createInviteSchema } from '../../../lib/validation/funding';

/**
 * GET /api/invites — pending invites for me (invitee) + sent by me.
 * Powers the Inbox page.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const [{ data: received }, { data: sent }] = await Promise.all([
      supabase.from('invites').select('*').eq('invitee_id', appUserId).eq('status', 'pending'),
      supabase.from('invites').select('*').eq('inviter_id', appUserId).eq('status', 'pending'),
    ]);
    return NextResponse.json({ received: received ?? [], sent: sent ?? [] });
  } catch (error) {
    console.error('GET /api/invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/invites — send an invite (project OWNER or admin only).
 * Plan §05: invite by user id, @handle, or shareable link (no invitee set).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { entityType, entityId, inviteeId, inviteeHandle, message, expiresInDays } = parsed.data;

    if (!inviteeId && !inviteeHandle) {
      // Shareable link invite — token is the credential.
      const { data: invite, error } = await supabase
        .from('invites')
        .insert({
          id: crypto.randomUUID(),
          entity_type: entityType,
          entity_id: entityId,
          inviter_id: appUserId,
          role: 'collaborator',
          token: crypto.randomUUID(),
          status: 'pending',
          message: message ?? null,
          expires_at: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
        })
        .select()
        .single();
      if (error || !invite) {
        console.error('Error creating link invite:', error);
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      }
      // Ownership check AFTER insert would leak; verify project first for
      // entityType=project when no invitee scoping exists. Non-owners get
      // 403 here and the row is removed.
      if (entityType === 'project') {
        const { data: project } = await supabase
          .from('projects')
          .select('owner_user_id')
          .eq('id', entityId)
          .single();
        // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
        if (!project || (project.owner_user_id !== appUserId && ctx.session.role !== 'admin')) {
          await supabase.from('invites').update({ status: 'declined' }).eq('id', invite.id);
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      return NextResponse.json({ invite }, { status: 201 });
    }

    // Targeted invite: ownership enforced BEFORE insert (project owner
    // or article author; admin bypasses both).
    if (entityType === 'article') {
      const { data: article } = await supabase
        .from('articles')
        .select('author_id')
        .eq('id', entityId)
        .is('deleted_at', null)
        .single();
      if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
      if (article.author_id !== appUserId && ctx.session.role !== 'admin') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (entityType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('owner_user_id')
        .eq('id', entityId)
        .is('deleted_at', null)
        .single();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
      if (project.owner_user_id !== appUserId && ctx.session.role !== 'admin') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        id: crypto.randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        inviter_id: appUserId,
        invitee_id: inviteeId ?? null,
        invitee_handle: inviteeHandle ?? null,
        role: 'collaborator',
        token: crypto.randomUUID(),
        status: 'pending',
        message: message ?? null,
        expires_at: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
      })
      .select()
      .single();
    if (error || !invite) {
      console.error('Error creating invite:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}