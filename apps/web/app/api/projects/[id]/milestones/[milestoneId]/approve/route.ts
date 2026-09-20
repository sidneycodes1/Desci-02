import { NextRequest, NextResponse } from 'next/server';

import { requireAppSession } from '../../../../../../../lib/app-session';
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
    const ctx = await requireAppSession(request);
    if (!ctx.ok) return ctx.response;
    const session = ctx.session;

    const body = await request.json().catch(() => ({}));
    const validationResult = approveMilestoneSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = session.supabase;

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

    // Determine reviewer role: admin, owner, or funder
    const isOwner = project.owner_user_id === session.appUserId;
    // Platform-admin override is intentional — per-project check is primary, global admin is deliberate fallback (not legacy).
    const isAdmin = session.role === 'admin';

    // Check if user is a funder of this project (total_funded_wei > 0)
    const { data: funderRow } = await supabase
      .from('project_funders')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', session.appUserId)
      .maybeSingle();

    const isFunder = !!funderRow && BigInt(funderRow.total_funded_wei) > 0n;

    let reviewerRole: 'admin' | 'owner' | 'funder' | 'collaborator' | 'viewer';
    if (isAdmin) {
      reviewerRole = 'admin';
    } else if (isOwner) {
      reviewerRole = 'owner';
    } else if (isFunder) {
      reviewerRole = 'funder';
    } else {
      reviewerRole = 'collaborator';
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
      reviewerUserId: session.appUserId,
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
        reviewer_user_id: session.appUserId,
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
          proposer_user_id: session.appUserId,
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