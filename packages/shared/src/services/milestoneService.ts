export type MilestoneState = 'created' | 'submitted' | 'approved' | 'rejected';

export interface MilestoneRecord {
  id: string;
  projectId: string;
  onchainMilestoneId?: number | null;
  title: string;
  descriptionUri: string;
  proofUri?: string | null;
  state: MilestoneState;
  creatorUserId: string;
  reviewerUserId?: string | null;
}

export type ReviewerRole = 'admin' | 'owner' | 'funder' | 'collaborator' | 'viewer';

export interface ProcessApprovalParams {
  milestone: MilestoneRecord;
  reviewerRole: ReviewerRole;
  reviewerUserId: string;
  projectOwnerWallet: string;
  releaseAmountWei?: string;
  currentOnchainBalanceWei: string;
}

export interface ApprovalResult {
  success: boolean;
  error?: string;
  code?:
    | 'UNAUTHORIZED'
    | 'NOT_SUBMITTED'
    | 'ALREADY_APPROVED'
    | 'INSUFFICIENT_TREASURY_FUNDS'
    | 'INVALID_TRANSITION';
  fundReleaseTriggered: boolean;
  releasePayload?: {
    recipientAddress: string;
    amountWei: string;
    memo: string;
  };
}

/**
 * Validates milestone state machine transition.
 * Rules:
 * created -> submitted
 * submitted -> approved | rejected | submitted (re-submission)
 * approved -> Terminal (reverts)
 */
export function validateMilestoneTransition(
  currentState: MilestoneState,
  targetState: MilestoneState
): { valid: boolean; error?: string } {
  if (currentState === 'approved') {
    return {
      valid: false,
      error: 'Cannot modify or transition an approved milestone (terminal state)',
    };
  }

  if (targetState === 'submitted') {
    if (currentState !== 'created' && currentState !== 'submitted' && currentState !== 'rejected') {
      return { valid: false, error: `Cannot submit proof from state '${currentState}'` };
    }
    return { valid: true };
  }

  if (targetState === 'approved') {
    if (currentState !== 'submitted') {
      return { valid: false, error: 'Cannot approve milestone before proof is submitted' };
    }
    return { valid: true };
  }

  if (targetState === 'rejected') {
    if (currentState !== 'submitted') {
      return { valid: false, error: 'Cannot reject milestone that is not in submitted state' };
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: `Invalid milestone transition from '${currentState}' to '${targetState}'`,
  };
}

/**
 * Processes milestone approval and generates on-chain treasury fund release trigger.
 */
export function processMilestoneApproval(params: ProcessApprovalParams): ApprovalResult {
  const {
    milestone,
    reviewerRole,
    projectOwnerWallet,
    releaseAmountWei,
    currentOnchainBalanceWei,
  } = params;

  // 1. Role Check: Approver must be admin, project owner, or funder
  if (
    reviewerRole !== 'admin' &&
    reviewerRole !== 'owner' &&
    reviewerRole !== 'funder'
  ) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error:
        'Only project owners, admins, or funders can approve milestones and trigger fund releases',
      fundReleaseTriggered: false,
    };
  }

  // 2. Transition Check: Must be in 'submitted' state with a proof URI
  const transition = validateMilestoneTransition(milestone.state, 'approved');
  if (!transition.valid) {
    return {
      success: false,
      code: milestone.state === 'approved' ? 'ALREADY_APPROVED' : 'NOT_SUBMITTED',
      error: transition.error ?? 'Invalid transition',
      fundReleaseTriggered: false,
    };
  }

  if (!milestone.proofUri || milestone.proofUri.trim() === '') {
    return {
      success: false,
      code: 'NOT_SUBMITTED',
      error: 'Milestone proof URI is missing or empty',
      fundReleaseTriggered: false,
    };
  }

  // 3. Fund Release Trigger Check (if an automatic release amount is specified)
  let fundReleaseTriggered = false;
  let releasePayload: ApprovalResult['releasePayload'];

  if (releaseAmountWei && releaseAmountWei !== '0') {
    try {
      const releaseBigInt = BigInt(releaseAmountWei);
      const balanceBigInt = BigInt(currentOnchainBalanceWei);

      if (releaseBigInt > balanceBigInt) {
        return {
          success: false,
          code: 'INSUFFICIENT_TREASURY_FUNDS',
          error: `Treasury funding failure: milestone release of ${releaseAmountWei} wei exceeds treasury balance ${currentOnchainBalanceWei} wei`,
          fundReleaseTriggered: false,
        };
      }

      fundReleaseTriggered = true;
      releasePayload = {
        recipientAddress: projectOwnerWallet,
        amountWei: releaseAmountWei,
        memo: `Milestone Approval Payout: ${milestone.title} (ID: ${milestone.id})`,
      };
    } catch {
      return {
        success: false,
        code: 'NOT_SUBMITTED',
        error: 'Invalid release amount string format',
        fundReleaseTriggered: false,
      };
    }
  }

  return {
    success: true,
    fundReleaseTriggered,
    releasePayload,
  };
}
