import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../../../lib/app-session';
import { submitMilestoneProofSchema } from '../../../../../../../lib/validation/milestone';

/**
 * POST /api/projects/[id]/milestones/[milestoneId]/submit - Submit proof URI for a milestone
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id, milestoneId } = await params;
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json();
    const validationResult = submitMilestoneProofSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    // Get milestone entry
    const { data: milestone } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', milestoneId)
      .eq('project_id', id)
      .is('deleted_at', null)
      .single();

    // Get project for owner/collaborator check
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const isCreator = milestone.creator_user_id === session.appUserId;

    const isOwner = project.owner_user_id === session.appUserId;
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', session.appUserId)
      .single();

    // Allow if: creator, owner, collaborator, OR global admin
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    if (!isCreator && !isOwner && !collaborator && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Only milestone creator, owner, collaborators, or admin can submit proof' }, { status: 403 });
    }

    // Update milestone state to submitted
    const { data: updatedMilestone, error } = await supabase
      .from('milestones')
      .update({
        proof_uri: validationResult.data.proofUri,
        state: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .select()
      .single();

    if (error) {
      console.error('Error submitting milestone proof:', error);
      return NextResponse.json({ error: 'Failed to submit milestone proof' }, { status: 500 });
    }

    return NextResponse.json({ milestone: updatedMilestone });
  } catch (error) {
    console.error('POST /api/projects/[id]/milestones/[milestoneId]/submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}