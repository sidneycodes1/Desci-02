import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { submitMilestoneProofSchema } from '../../../../../../../lib/validation/milestone';
import {
  validateMilestoneTransition,
  type MilestoneState,
} from '@sciagent/shared/services/milestoneService';

/**
 * POST /api/projects/[id]/milestones/[milestoneId]/submit - Submit proof URI for a milestone
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
    const validationResult = submitMilestoneProofSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

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

    // Validate transition state
    const transitionCheck = validateMilestoneTransition(
      milestone.state as MilestoneState,
      'submitted'
    );
    if (!transitionCheck.valid) {
      return NextResponse.json({ error: transitionCheck.error }, { status: 400 });
    }

    // Permission check: Creator or project owner
    const { data: project } = await supabase.from('projects').select('*').eq('id', id).single();

    const isCreator = milestone.creator_user_id === session.userId;
    const isOwner = project?.owner_user_id === session.userId || session.role === 'admin';

    if (!isCreator && !isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only milestone creator or project owner can submit proof' },
        { status: 403 }
      );
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
