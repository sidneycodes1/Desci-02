import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';

/**
 * GET /api/projects/[id]/treasury - Fetch treasury balance & sync status for a project
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

    // Get treasury balance record
    const { data: balance, error } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching treasury balance:', error);
      return NextResponse.json({ error: 'Failed to fetch treasury balance' }, { status: 500 });
    }

    return NextResponse.json({
      balance: balance ?? {
        projectId: id,
        onchainBalanceWei: '0',
        lastSyncedAt: null,
        lastSyncedBlock: null,
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/treasury error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
