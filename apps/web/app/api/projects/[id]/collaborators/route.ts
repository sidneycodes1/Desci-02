import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { addCollaboratorSchema, removeCollaboratorSchema } from '../../../../../lib/validation/project';

/**
 * GET /api/projects/[id]/collaborators - List project collaborators
 * Requires authentication and project access
 */
export async function GET(
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

    // Check project access
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

    // Get all collaborators with user details
    const { data: collaborators, error } = await supabase
      .from('project_collaborators')
      .select('*, users(id, email, role)')
      .eq('project_id', id);

    if (error) {
      console.error('Error fetching collaborators:', error);
      return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
    }

    return NextResponse.json({ collaborators });
  } catch (error) {
    console.error('GET /api/projects/[id]/collaborators error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/collaborators - Add a collaborator
 * Requires authentication and owner role
 */
export async function POST(
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

    const body = await request.json();
    const validationResult = addCollaboratorSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, role } = validationResult.data;

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

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a collaborator
    const { data: existing } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
    }

    // Add collaborator
    const { data: collaborator, error } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: id,
        user_id: userId,
        role: role || 'collaborator',
      })
      .select('*, users(id, email, role)')
      .single();

    if (error) {
      console.error('Error adding collaborator:', error);
      return NextResponse.json({ error: 'Failed to add collaborator' }, { status: 500 });
    }

    return NextResponse.json({ collaborator }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/collaborators error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
