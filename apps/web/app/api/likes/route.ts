/* eslint-disable @typescript-eslint/no-explicit-any -- supabase shim typed as any in handler tests, same as other routes */
import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../lib/app-session';
import { likeSchema } from '../../../lib/validation/engagement';

async function isTargetVisible(
  supabase: any,
  targetType: 'project' | 'article',
  targetId: string,
  appUserId: string
): Promise<{ found: boolean; visible: boolean }> {
  if (targetType === 'project') {
    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_user_id, status, deleted_at')
      .eq('id', targetId)
      .is('deleted_at', null)
      .single();
    if (!project) return { found: false, visible: false };
    const isOwner = project.owner_user_id === appUserId;
    if (isOwner) return { found: true, visible: true };
    if (project.status !== 'draft') return { found: true, visible: true };
    const { data: collab } = await supabase
      .from('project_collaborators')
      .select('project_id')
      .eq('project_id', targetId)
      .eq('user_id', appUserId)
      .single();
    return { found: true, visible: !!collab };
  }
  // article
  const { data: article } = await supabase
    .from('articles')
    .select('id, author_id, status, deleted_at')
    .eq('id', targetId)
    .is('deleted_at', null)
    .single();
  if (!article) return { found: false, visible: false };
  if (article.author_id === appUserId) return { found: true, visible: true };
  if (article.status === 'published') return { found: true, visible: true };
  const { data: ac } = await supabase
    .from('article_collaborators')
    .select('article_id')
    .eq('article_id', targetId)
    .eq('user_id', appUserId)
    .single();
  return { found: true, visible: !!ac };
}

/**
 * GET /api/likes?targetType=project|article&targetId=uuid
 * Returns { count, liked } for current user.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType') as 'project' | 'article' | null;
    const targetId = searchParams.get('targetId');

    if (!targetType || !targetId || !['project', 'article'].includes(targetType)) {
      return NextResponse.json({ error: 'targetType and targetId required' }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
      return NextResponse.json({ error: 'Invalid targetId' }, { status: 400 });
    }

    const vis = await isTargetVisible(supabase, targetType, targetId, appUserId);
    if (!vis.found) return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    if (!vis.visible) return NextResponse.json({ error: 'Not visible' }, { status: 403 });

    const { data: likes, error } = await supabase
      .from('likes')
      .select('id, user_id')
      .eq('target_type', targetType)
      .eq('target_id', targetId);

    if (error) {
      console.error('GET /api/likes error:', error);
      return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }
    const count = (likes ?? []).length;
    const liked = (likes ?? []).some((r: any) => r.user_id === appUserId);
    return NextResponse.json({ count, liked });
  } catch (error) {
    console.error('GET /api/likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/likes — body: { targetType, targetId }
 * Toggle: if already liked, unlike (delete); else like (insert).
 * Relies on unique constraint likes_user_target_unique to prevent duplicates;
 * handles conflict gracefully.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = likeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { targetType, targetId } = parsed.data;

    const vis = await isTargetVisible(supabase, targetType as 'project' | 'article', targetId, appUserId);
    if (!vis.found) return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    if (!vis.visible) return NextResponse.json({ error: 'Not visible' }, { status: 403 });

    // Check existing
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', appUserId)
      .maybeSingle();

    if (existing) {
      // Unlike — hard delete
      const { error } = await supabase.from('likes').delete().eq('id', existing.id);
      if (error) {
        console.error('Error unliking:', error);
        return NextResponse.json({ error: 'Failed to unlike' }, { status: 500 });
      }
      // Return updated count
      const { data: likes } = await supabase
        .from('likes')
        .select('id')
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      return NextResponse.json({ liked: false, count: (likes ?? []).length });
    }

    // Like — insert, handle unique violation gracefully (race -> treat as already liked)
    const { data: inserted, error } = await supabase
      .from('likes')
      .insert({
        id: crypto.randomUUID(),
        target_type: targetType,
        target_id: targetId,
        user_id: appUserId,
      })
      .select()
      .single();

    if (error) {
      // Unique violation (Postgres 23505) means concurrent insert won — treat as liked
      const msg = String((error as any).message ?? '');
      const code = (error as any).code;
      if (code === '23505' || msg.includes('likes_user_target_unique') || msg.includes('duplicate')) {
        const { data: likes } = await supabase
          .from('likes')
          .select('id')
          .eq('target_type', targetType)
          .eq('target_id', targetId);
        return NextResponse.json({ liked: true, count: (likes ?? []).length });
      }
      console.error('Error liking:', error);
      return NextResponse.json({ error: 'Failed to like' }, { status: 500 });
    }

    const { data: likes } = await supabase
      .from('likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId);

    return NextResponse.json({ liked: true, count: (likes ?? []).length, like: inserted }, { status: 201 });
  } catch (error) {
    console.error('POST /api/likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
