import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../lib/app-session';
import { createProjectSchema } from '../../../lib/validation/project';

/**
 * GET /api/projects - List projects for authenticated user
 * Returns projects where user is owner or collaborator
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;
    const { appUserId, supabase } = session;

    // Get projects where user is owner or collaborator
    const { data: ownerProjects, error: ownerError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_user_id', appUserId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (ownerError) {
      console.error('Error fetching owner projects:', ownerError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    const { data: collaboratorProjects, error: collaboratorError } = await supabase
      .from('project_collaborators')
      .select('projects(*)')
      .eq('user_id', appUserId)
      .is('projects.deleted_at', null);

    if (collaboratorError) {
      console.error('Error fetching collaborator projects:', collaboratorError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    const allProjects = [
      ...(ownerProjects || []),
      ...((collaboratorProjects ?? []) as Array<{ projects: unknown }>)
        .map((cp) => cp.projects)
        .filter(Boolean),
    ];

    return NextResponse.json({ projects: allProjects, userRole: session.role });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects - Create a new project
 * Plan §09: ANY authenticated wallet can create; creator becomes the
 * project owner (`owner_user_id`). Global Privy role gates admin
 * endpoints only — never creation. Edit stays per-project
 * (owner or invited collaborator).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;
    const { appUserId, supabase } = session;

    const body = await request.json();
    const validationResult = createProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, metadataUri, status } = validationResult.data;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        owner_user_id: appUserId,
        name,
        metadata_uri: metadataUri,
        status: status || 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
