import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../../lib/app-session';

/**
 * GET /api/projects/[id]/logs/[logId] - Get a specific research log
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const supabase = session.supabase;

    const { data: log, error } = await supabase
      .from('research_logs')
      .select('*, users!author_user_id(id, email, role)')
      .eq('id', logId)
      .eq('project_id', id)
      .is('deleted_at', null)
      .single();

    if (error || !log) {
      return NextResponse.json({ error: 'Research log not found' }, { status: 404 });
    }

    // Verify user has access to project
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.owner_user_id === session.appUserId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', session.appUserId)
      .single();

    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ log });
  } catch (error) {
    console.error('GET /api/projects/[id]/logs/[logId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/logs/[logId] - Soft delete a research log
 * Requires author of the log or project owner
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const supabase = session.supabase;

    // Get log entry
    const { data: log } = await supabase
      .from('research_logs')
      .select('*')
      .eq('id', logId)
      .eq('project_id', id)
      .is('deleted_at', null)
      .single();

    if (!log) {
      return NextResponse.json({ error: 'Research log not found' }, { status: 404 });
    }

    // Get project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    const isAuthor = log.author_user_id === session.appUserId;
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    const isOwner = project?.owner_user_id === session.appUserId || session.role === 'admin';

    if (!isAuthor && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('research_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', logId);

    if (error) {
      console.error('Error deleting research log:', error);
      return NextResponse.json({ error: 'Failed to delete research log' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/logs/[logId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}