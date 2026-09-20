import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '../../../../../lib/app-session';
import { projectSettingsSchema } from '../../../../../lib/validation/settings';
import { canTransitionStatus, type ProjectStatus } from '../../../../../lib/state-machine/project';

/**
 * GET /api/projects/[id]/settings - Get project settings
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const supabase = session.supabase;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.owner_user_id === session.appUserId;
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    if (!isOwner && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied: Only owner or admin can view project settings' },
        { status: 403 }
      );
    }

    return NextResponse.json({ settings: project });
  } catch (error) {
    console.error('GET /api/projects/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/settings - Update project settings & state transition
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validation = projectSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    // Permission check: Owner or Admin
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_user_id !== session.appUserId && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied: Only owner or admin can update project settings' },
        { status: 403 }
      );
    }

    // State transition check if status is updated
    if (validation.data.status && validation.data.status !== project.status) {
      if (!canTransitionStatus(project.status as ProjectStatus, validation.data.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${project.status} to ${validation.data.status}`,
          },
          { status: 400 }
        );
      }
    }

    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update({
        name: validation.data.name,
        metadata_uri: validation.data.metadataUri,
        status: validation.data.status ?? project.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating project settings:', error);
      return NextResponse.json({ error: 'Failed to update project settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: updatedProject });
  } catch (error) {
    console.error('PUT /api/projects/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
