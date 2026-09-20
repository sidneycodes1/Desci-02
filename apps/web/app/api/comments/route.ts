/* eslint-disable @typescript-eslint/no-explicit-any -- supabase shim typed as any in handler tests, same as other routes */
import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../lib/app-session';
import { createCommentSchema } from '../../../lib/validation/engagement';

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
 * GET /api/comments?targetType=project|article&targetId=uuid
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

    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, target_type, target_id, author_user_id, body, created_at')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET /api/comments error:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments ?? [] });
  } catch (error) {
    console.error('GET /api/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/comments — body: { targetType, targetId, body }
 * Any authenticated user who can see the parent can comment.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const { appUserId, supabase } = ctx.session;

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { targetType, targetId, body: commentBody } = parsed.data;

    const vis = await isTargetVisible(supabase, targetType as 'project' | 'article', targetId, appUserId);
    if (!vis.found) return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    if (!vis.visible) return NextResponse.json({ error: 'Not visible' }, { status: 403 });

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        id: crypto.randomUUID(),
        target_type: targetType,
        target_id: targetId,
        author_user_id: appUserId,
        body: commentBody,
      })
      .select('id, target_type, target_id, author_user_id, body, created_at')
      .single();

    if (error || !comment) {
      console.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('POST /api/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
