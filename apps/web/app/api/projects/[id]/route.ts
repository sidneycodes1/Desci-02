import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { updateProjectSchema } from '../../../../lib/validation/project';
import {
  validateStatusTransition,
  type ProjectStatus,
} from '../../../../lib/state-machine/project';

/**
 * GET /api/projects/[id] - Get a specific project
 * Requires authentication and access (owner or collaborator)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const supabase = createSupabaseClientFromToken(token);

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access: owner or collaborator
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

    // Determine user role for this project
    let userRole: 'admin' | 'owner' | 'member' | 'viewer' = 'viewer';
    if (session.role === 'admin') {
      userRole = 'admin';
    } else if (isOwner) {
      userRole = 'owner';
    } else if (collaborator) {
      userRole = 'member';
    }

    return NextResponse.json({ project, userRole });
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id] - Update a project
 * Requires authentication and owner role
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const body = await request.json();
    const validationResult = updateProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

    // Check ownership
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_user_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate status transition if status is being changed
    if (validationResult.data.status && validationResult.data.status !== project.status) {
      try {
        validateStatusTransition(project.status as ProjectStatus, validationResult.data.status);
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
      }
    }

    const updateData: {
      name?: string;
      metadata_uri?: string;
      status?: ProjectStatus;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (validationResult.data.name !== undefined) updateData.name = validationResult.data.name;
    if (validationResult.data.metadataUri !== undefined)
      updateData.metadata_uri = validationResult.data.metadataUri;
    if (validationResult.data.status !== undefined)
      updateData.status = validationResult.data.status;

    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id] - Soft delete a project
 * Requires authentication and owner role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const supabase = createSupabaseClientFromToken(token);

    // Check ownership
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_user_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only allow deletion of draft projects
    if (project.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete projects in draft status' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
