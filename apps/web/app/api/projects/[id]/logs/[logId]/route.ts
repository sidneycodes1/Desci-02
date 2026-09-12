import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';

/**
 * GET /api/projects/[id]/logs/[logId] - Get a specific research log
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const supabase = createSupabaseClientFromToken(token);

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

    const isOwner = project.owner_user_id === session.userId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', session.userId)
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const supabase = createSupabaseClientFromToken(token);

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

    const isAuthor = log.author_user_id === session.userId;
    const isOwner = project?.owner_user_id === session.userId || session.role === 'admin';

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
