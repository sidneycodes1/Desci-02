import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseClientFromToken } from '@sciagent/shared/supabase/server';
import { verifySession } from '@sciagent/auth/session';
import { approveMilestoneSchema } from '../../../../../../../lib/validation/milestone';
import {
  processMilestoneApproval,
  type MilestoneState,
} from '@sciagent/shared/services/milestoneService';

/**
 * POST /api/projects/[id]/milestones/[milestoneId]/approve - Approve milestone & trigger treasury fund release
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

    const body = await request.json().catch(() => ({}));
    const validationResult = approveMilestoneSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClientFromToken(token);

    // Get project & owner wallet
    const { data: project } = await supabase
      .from('projects')
      .select('*, users!owner_user_id(id, wallets(address))')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Determine reviewer role
    const isOwner = project.owner_user_id === session.userId;
    const reviewerRole = session.role === 'admin' ? 'admin' : isOwner ? 'owner' : 'collaborator';

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

    // Get owner wallet address
    const ownerWallets = project.users?.wallets;
    const ownerWalletAddress =
      Array.isArray(ownerWallets) && ownerWallets.length > 0
        ? ownerWallets[0].address
        : '0x0000000000000000000000000000000000000000';

    // Get current treasury balance for budget check
    const { data: treasuryBalance } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('project_id', id)
      .maybeSingle();

    const currentBalanceWei = treasuryBalance?.onchain_balance_wei ?? '0';

    // Process approval logic & fund release trigger
    const approval = processMilestoneApproval({
      milestone: {
        id: milestone.id,
        projectId: milestone.project_id,
        title: milestone.title,
        descriptionUri: milestone.description_uri,
        proofUri: milestone.proof_uri,
        state: milestone.state as MilestoneState,
        creatorUserId: milestone.creator_user_id,
      },
      reviewerRole,
      reviewerUserId: session.userId,
      projectOwnerWallet: ownerWalletAddress,
      releaseAmountWei: validationResult.data.releaseAmountWei,
      currentOnchainBalanceWei: currentBalanceWei,
    });

    if (!approval.success) {
      return NextResponse.json(
        { error: approval.error, code: approval.code },
        { status: approval.code === 'UNAUTHORIZED' ? 403 : 400 }
      );
    }

    // Update milestone state in DB
    const { data: updatedMilestone, error: updateErr } = await supabase
      .from('milestones')
      .update({
        state: 'approved',
        reviewer_user_id: session.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error approving milestone:', updateErr);
      return NextResponse.json({ error: 'Failed to update milestone approval' }, { status: 500 });
    }

    // If a fund release was triggered, record corresponding expense release in DB
    let recordedExpense = null;
    if (approval.fundReleaseTriggered && approval.releasePayload) {
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .insert({
          project_id: id,
          proposer_user_id: session.userId,
          recipient_address: approval.releasePayload.recipientAddress,
          amount_wei: approval.releasePayload.amountWei,
          memo: approval.releasePayload.memo,
          status: 'approved',
        })
        .select()
        .single();

      if (!expErr) {
        recordedExpense = expData;
      }
    }

    return NextResponse.json({
      milestone: updatedMilestone,
      approval,
      fundReleaseExpense: recordedExpense,
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/milestones/[milestoneId]/approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
