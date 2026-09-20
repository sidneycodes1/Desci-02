import { describe, expect, it } from 'vitest';
import {
  validateMilestoneTransition,
  processMilestoneApproval,
  MilestoneRecord,
} from '../src/services/milestoneService';

describe('Milestone Service', () => {
  describe('validateMilestoneTransition', () => {
    it('allows created -> submitted', () => {
      const res = validateMilestoneTransition('created', 'submitted');
      expect(res.valid).toBe(true);
    });

    it('allows submitted -> approved', () => {
      const res = validateMilestoneTransition('submitted', 'approved');
      expect(res.valid).toBe(true);
    });

    it('allows submitted -> rejected', () => {
      const res = validateMilestoneTransition('submitted', 'rejected');
      expect(res.valid).toBe(true);
    });

    it('allows rejected -> submitted (resubmission)', () => {
      const res = validateMilestoneTransition('rejected', 'submitted');
      expect(res.valid).toBe(true);
    });

    it('prevents direct created -> approved', () => {
      const res = validateMilestoneTransition('created', 'approved');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('before proof is submitted');
    });

    it('prevents any modification on approved milestone (terminal state)', () => {
      const res1 = validateMilestoneTransition('approved', 'submitted');
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('terminal state');

      const res2 = validateMilestoneTransition('approved', 'rejected');
      expect(res2.valid).toBe(false);
    });
  });

  describe('processMilestoneApproval', () => {
    const mockMilestone: MilestoneRecord = {
      id: 'm-1',
      projectId: 'p-1',
      title: 'Milestone 1',
      descriptionUri: 'https://ipfs.io/ipfs/QmDesc',
      proofUri: 'https://ipfs.io/ipfs/QmProof',
      state: 'submitted',
      creatorUserId: 'user-creator',
    };

    it('blocks approval if reviewer is collaborator or viewer', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'collaborator',
        reviewerUserId: 'user-collab',
        projectOwnerWallet: '0x123',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('approves milestone for project owner without automatic fund release', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'owner',
        reviewerUserId: 'user-owner',
        projectOwnerWallet: '0xOwnerWallet',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(true);
      expect(result.fundReleaseTriggered).toBe(false);
    });

    it('approves milestone and triggers fund release when releaseAmountWei specified', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'owner',
        reviewerUserId: 'user-owner',
        projectOwnerWallet: '0xOwnerWallet',
        releaseAmountWei: '500000',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(true);
      expect(result.fundReleaseTriggered).toBe(true);
      expect(result.releasePayload).toEqual({
        recipientAddress: '0xOwnerWallet',
        amountWei: '500000',
        memo: 'Milestone Approval Payout: Milestone 1 (ID: m-1)',
      });
    });

    it('approves milestone as funder without automatic fund release', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'funder',
        reviewerUserId: 'user-funder',
        projectOwnerWallet: '0xOwnerWallet',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(true);
      expect(result.fundReleaseTriggered).toBe(false);
    });

    it('approves milestone as funder with fund release when releaseAmountWei specified and balance sufficient', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'funder',
        reviewerUserId: 'user-funder',
        projectOwnerWallet: '0xOwnerWallet',
        releaseAmountWei: '200000',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(true);
      expect(result.fundReleaseTriggered).toBe(true);
      expect(result.releasePayload).toEqual({
        recipientAddress: '0xOwnerWallet',
        amountWei: '200000',
        memo: 'Milestone Approval Payout: Milestone 1 (ID: m-1)',
      });
    });

    it('rejects approval if release amount exceeds treasury balance', () => {
      const result = processMilestoneApproval({
        milestone: mockMilestone,
        reviewerRole: 'admin',
        reviewerUserId: 'user-admin',
        projectOwnerWallet: '0xOwnerWallet',
        releaseAmountWei: '2000000',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_TREASURY_FUNDS');
      expect(result.fundReleaseTriggered).toBe(false);
    });

    it('rejects approval if proof Uri is missing', () => {
      const result = processMilestoneApproval({
        milestone: { ...mockMilestone, proofUri: '' },
        reviewerRole: 'owner',
        reviewerUserId: 'user-owner',
        projectOwnerWallet: '0xOwnerWallet',
        currentOnchainBalanceWei: '1000000',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_SUBMITTED');
    });
  });
});
