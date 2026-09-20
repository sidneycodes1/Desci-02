import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../lib/app-session';

/**
 * GET /api/projects/[id]/treasury - Fetch treasury balance & sync status for a project
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
