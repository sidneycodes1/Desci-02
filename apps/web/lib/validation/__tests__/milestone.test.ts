import { describe, expect, it } from 'vitest';
import {
  createMilestoneSchema,
  submitMilestoneProofSchema,
  approveMilestoneSchema,
  rejectMilestoneSchema,
} from '../milestone';

describe('Milestone Validation Schemas', () => {
  describe('createMilestoneSchema', () => {
    it('validates a valid create milestone input', () => {
      const result = createMilestoneSchema.safeParse({
        title: 'Phase 1 Delivery',
        descriptionUri: 'https://ipfs.io/ipfs/QmHashDescription',
      });
      expect(result.success).toBe(true);
    });

    it('fails when title is empty', () => {
      const result = createMilestoneSchema.safeParse({
        title: '',
        descriptionUri: 'https://ipfs.io/ipfs/QmHashDescription',
      });
      expect(result.success).toBe(false);
    });

    it('fails when descriptionUri is invalid URL', () => {
      const result = createMilestoneSchema.safeParse({
        title: 'Phase 1',
        descriptionUri: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('submitMilestoneProofSchema', () => {
    it('validates a valid proof submission input', () => {
      const result = submitMilestoneProofSchema.safeParse({
        proofUri: 'https://ipfs.io/ipfs/QmHashProof',
      });
      expect(result.success).toBe(true);
    });

    it('fails when proofUri is missing or invalid', () => {
      const result = submitMilestoneProofSchema.safeParse({
        proofUri: 'invalid-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('approveMilestoneSchema', () => {
    it('validates a valid approval with release amount and comment', () => {
      const result = approveMilestoneSchema.safeParse({
        releaseAmountWei: '1000000000000000000',
        comment: 'Great work on Phase 1!',
      });
      expect(result.success).toBe(true);
    });

    it('validates approval without release amount', () => {
      const result = approveMilestoneSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid release amount wei format', () => {
      const result = approveMilestoneSchema.safeParse({
        releaseAmountWei: '-500',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rejectMilestoneSchema', () => {
    it('validates a valid rejection input', () => {
      const result = rejectMilestoneSchema.safeParse({
        reason: 'Proof is incomplete, missing datasets.',
      });
      expect(result.success).toBe(true);
    });

    it('fails when reason is empty', () => {
      const result = rejectMilestoneSchema.safeParse({
        reason: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
