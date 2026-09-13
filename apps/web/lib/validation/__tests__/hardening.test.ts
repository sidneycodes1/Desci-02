import { describe, expect, it } from 'vitest';
import { proposeExpenseSchema } from '../treasury';
import { createResearchLogSchema } from '../researchLog';
import { approveMilestoneSchema } from '../milestone';

describe('Security & Money-Movement Hardening Tests', () => {
  describe('Treasury & Spend Request Guards', () => {
    it('rejects zero or negative wei amount in proposal schema', () => {
      const result = proposeExpenseSchema.safeParse({
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amountWei: '0',
        memo: 'Zero amount test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid Ethereum recipient address format', () => {
      const result = proposeExpenseSchema.safeParse({
        recipientAddress: '0xinvalid',
        amountWei: '1000000000000000000',
        memo: 'Invalid recipient',
      });
      expect(result.success).toBe(false);
    });

    it('rejects oversized expense memo (>1024 characters)', () => {
      const longMemo = 'A'.repeat(1025);
      const result = proposeExpenseSchema.safeParse({
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amountWei: '1000000',
        memo: longMemo,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Milestone Approval Guards', () => {
    it('rejects negative release amount string', () => {
      const result = approveMilestoneSchema.safeParse({
        releaseAmountWei: '-1000',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Research Log Evidence Guards', () => {
    it('rejects research log with title exceeding 200 characters', () => {
      const longTitle = 'Title '.repeat(50);
      const result = createResearchLogSchema.safeParse({
        title: longTitle,
        content: 'Valid content body',
      });
      expect(result.success).toBe(false);
    });
  });
});
