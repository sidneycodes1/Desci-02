import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../lib/app-session';
import { createResearchLogSchema } from '../../../../../lib/validation/researchLog';
import { notifyResearchLogCreated } from '@sciagent/shared/services/notificationService';

/**
 * GET /api/projects/[id]/logs - List research logs for a project
 * Requires authentication and project access (owner or collaborator)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const supabase = session.supabase;

    // Verify project access
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

    // Fetch research logs
    const { data: logs, error } = await supabase
      .from('research_logs')
      .select('*, users!author_user_id(id, email, role)')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching research logs:', error);
      return NextResponse.json({ error: 'Failed to fetch research logs' }, { status: 500 });
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/projects/[id]/logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/logs - Create a research log
 * Requires authentication and project collaborator/owner access
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validationResult = createResearchLogSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    // Verify project access
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

    // Insert research log
    const { data: log, error } = await supabase
      .from('research_logs')
      .insert({
        project_id: id,
        author_user_id: session.appUserId,
        title: validationResult.data.title,
        content: validationResult.data.content,
        evidence_cid: validationResult.data.evidenceCid ?? null,
        evidence_mime_type: validationResult.data.evidenceMimeType ?? null,
        evidence_size_bytes: validationResult.data.evidenceSizeBytes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating research log:', error);
      return NextResponse.json({ error: 'Failed to create research log' }, { status: 500 });
    }

    notifyResearchLogCreated({
      authorUserId: session.appUserId,
      projectOwnerUserId: project.owner_user_id,
      projectId: id,
      logTitle: validationResult.data.title,
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
