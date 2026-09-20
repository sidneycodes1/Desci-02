import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../lib/app-session';
import { createMilestoneSchema } from '../../../../../lib/validation/milestone';

/**
 * GET /api/projects/[id]/milestones - List milestones for a project
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

    const { data: milestonesList, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching milestones:', error);
      return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
    }

    return NextResponse.json({ milestones: milestonesList });
  } catch (error) {
    console.error('GET /api/projects/[id]/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/milestones - Create a new milestone
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
    const validationResult = createMilestoneSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    // Verify ownership
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
      .select('id')
      .eq('project_id', id)
      .eq('user_id', session.appUserId)
      .single();

    // Allow if: owner, collaborator, OR global admin
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    if (!isOwner && !collaborator && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Only project owner, collaborators, or admin can create milestones' }, { status: 403 });
    }

    // Insert milestone
    const { data: milestone, error } = await supabase
      .from('milestones')
      .insert({
        project_id: id,
        creator_user_id: session.appUserId,
        title: validationResult.data.title,
        description_uri: validationResult.data.descriptionUri,
        state: 'created',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating milestone:', error);
      return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
    }

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}