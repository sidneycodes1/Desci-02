import { describe, expect, it } from 'vitest';
import {
  validateSpendRequest,
  processMilestoneApproval,
  exportResearchLogsToCSV,
  exportExpensesToCSV,
  notifyMilestoneApproved,
  listUserNotifications,
} from '../src/services';

describe('Cross-Module End-to-End Integration Suite', () => {
  it('executes end-to-end lifecycle across treasury, milestone, reports, and notifications', () => {
    const projectOwnerWallet = '0x1111111111111111111111111111111111111111';
    const recipientWallet = '0x1111111111111111111111111111111111111111'; // Must match project owner

    // 1. Treasury spend validation
    const spendVal = validateSpendRequest({
      projectOwnerWallet,
      recipientAddress: recipientWallet,
      proposedAmountWei: '1000000000000000000',
      currentOnchainBalanceWei: '5000000000000000000',
      memo: 'Lab Equipment Purchase',
    });
    expect(spendVal.isValid).toBe(true);

    // 2. Milestone submission & approval workflow
    const milestoneRecord = {
      id: 'm-e2e-1',
      projectId: 'proj-e2e',
      title: 'Phase 1 Delivery',
      descriptionUri: 'https://ipfs.io/ipfs/QmDescHash',
      proofUri: 'https://ipfs.io/ipfs/QmProofHash',
      state: 'submitted' as const,
      creatorUserId: 'researcher-user-1',
    };

    const approvalResult = processMilestoneApproval({
      milestone: milestoneRecord,
      reviewerRole: 'owner',
      reviewerUserId: 'owner-user-1',
      projectOwnerWallet,
      releaseAmountWei: '1000000000000000000',
      currentOnchainBalanceWei: '5000000000000000000',
    });

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.fundReleaseTriggered).toBe(true);
    expect(approvalResult.releasePayload?.amountWei).toBe('1000000000000000000');

    // 3. Dispatch system notification
    notifyMilestoneApproved({
      creatorUserId: 'researcher-user-1',
      projectId: 'proj-e2e',
      milestoneTitle: milestoneRecord.title,
      releaseAmountWei: '1000000000000000000',
    });

    const notifs = listUserNotifications('researcher-user-1');
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].title).toBe('Milestone Approved!');

    // 4. Data export formatters
    const csvLogs = exportResearchLogsToCSV([
      {
        id: 'log-e2e-1',
        title: 'Initial Finding',
        content: 'Observation notes',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(csvLogs).toContain('Initial Finding');

    const csvExpenses = exportExpensesToCSV([
      {
        id: 'exp-e2e-1',
        recipientAddress: recipientWallet,
        amountWei: '1000000000000000000',
        memo: 'Lab Equipment Purchase',
        status: 'approved',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(csvExpenses).toContain('Lab Equipment Purchase');
  });
});
