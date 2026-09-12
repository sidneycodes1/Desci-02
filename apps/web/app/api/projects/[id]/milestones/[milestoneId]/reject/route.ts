import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { rejectMilestoneSchema } from '../../../../../../../lib/validation/milestone';
import { validateMilestoneTransition } from '@sciagent/shared/services/milestoneService';

/**
 * POST /api/projects/[id]/milestones/[milestoneId]/reject - Reject milestone with reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { id, milestoneId } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifySession(token);

    const body = await request.json();
    const validationResult = rejectMilestoneSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

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

    if (project.owner_user_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Only project owner or admin can reject milestones' }, { status: 403 });
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
    const transitionCheck = validateMilestoneTransition(milestone.state as any, 'rejected');
    if (!transitionCheck.valid) {
      return NextResponse.json({ error: transitionCheck.error }, { status: 400 });
    }

    // Update state to rejected
    const { data: updatedMilestone, error } = await supabase
      .from('milestones')
      .update({
        state: 'rejected',
        reviewer_user_id: session.userId,
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
