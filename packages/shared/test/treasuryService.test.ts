import { describe, expect, it } from 'vitest';

import {
  validateSpendRequest,
  reconcileProjectTreasuryState,
} from '../services/treasuryService';

describe('Treasury Service Logic & Budget Guards', () => {
  const sampleWallet = '0x1234567890123456789012345678901234567890';
  const otherWallet = '0x9999999999999999999999999999999999999999';

  it('validates a valid spend request successfully', () => {
    const result = validateSpendRequest({
      projectOwnerWallet: sampleWallet,
      recipientAddress: sampleWallet,
      proposedAmountWei: '1000000000000000000', // 1 ETH
      currentOnchainBalanceWei: '5000000000000000000', // 5 ETH
      memo: 'Equipment purchase for lab',
    });

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects spend request if recipient address does not match project owner wallet', () => {
    const result = validateSpendRequest({
      projectOwnerWallet: sampleWallet,
      recipientAddress: otherWallet,
      proposedAmountWei: '1000000000000000000',
      currentOnchainBalanceWei: '5000000000000000000',
      memo: 'Unallowed recipient payout',
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe('INVALID_RECIPIENT');
    expect(result.error).toContain('does not match project owner');
  });

  it('rejects spend request if amount exceeds current on-chain balance (insufficient funds)', () => {
    const result = validateSpendRequest({
      projectOwnerWallet: sampleWallet,
      recipientAddress: sampleWallet,
      proposedAmountWei: '10000000000000000000', // 10 ETH
      currentOnchainBalanceWei: '2000000000000000000', // 2 ETH
      memo: 'Overbudget request',
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_FUNDS');
    expect(result.error).toContain('Insufficient treasury funds');
  });

  it('rejects spend request with memo exceeding 1024 bytes', () => {
    const oversizedMemo = 'A'.repeat(1025);
    const result = validateSpendRequest({
      projectOwnerWallet: sampleWallet,
      recipientAddress: sampleWallet,
      proposedAmountWei: '1000000',
      currentOnchainBalanceWei: '5000000',
      memo: oversizedMemo,
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe('MEMO_TOO_LONG');
  });

  it('reconciles treasury balance state and detects drift', () => {
    const reconciliation = reconcileProjectTreasuryState('1000', {
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      onchainBalanceWei: '2500',
      onchainBlockNumber: 123456,
    });

    expect(reconciliation.driftDetected).toBe(true);
    expect(reconciliation.previousBalanceWei).toBe('1000');
    expect(reconciliation.newBalanceWei).toBe('2500');
    expect(reconciliation.syncedBlock).toBe(123456);
  });
});
