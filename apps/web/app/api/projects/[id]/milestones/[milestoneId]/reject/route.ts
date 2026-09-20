import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../../../lib/app-session';
import { rejectMilestoneSchema } from '../../../../../../../lib/validation/milestone';
import {
  validateMilestoneTransition,
  type MilestoneState,
} from '@sciagent/shared/services/milestoneService';

/**
 * POST /api/projects/[id]/milestones/[milestoneId]/reject - Reject milestone with reason
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
    const validationResult = rejectMilestoneSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

    // Permission check: Owner or Admin
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
      return NextResponse.json({ error: 'Access denied: Only project owner, collaborators, or admin can reject milestones' }, { status: 403 });
    }

    // Get milestone entry
    const { data: milestone } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', milestoneId)
      .eq('project_id', id)
      .is('deleted_at', null)
      .single();

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Validate transition
    const transitionCheck = validateMilestoneTransition(
      milestone.state as MilestoneState,
      'rejected'
    );
    if (!transitionCheck.valid) {
      return NextResponse.json({ error: transitionCheck.error }, { status: 400 });
    }

    // Update state to rejected
    const { data: updatedMilestone, error } = await supabase
      .from('milestones')
      .update({
        state: 'rejected',
        reviewer_user_id: session.appUserId,
      })
      .eq('id', milestoneId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting milestone:', error);
      return NextResponse.json({ error: 'Failed to reject milestone' }, { status: 500 });
    }

    return NextResponse.json({
      milestone: updatedMilestone,
      rejectionReason: validationResult.data.reason,
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/milestones/[milestoneId]/reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}