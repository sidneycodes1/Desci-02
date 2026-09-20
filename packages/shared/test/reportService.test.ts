import { describe, expect, it } from 'vitest';
import {
  exportResearchLogsToCSV,
  exportExpensesToCSV,
  exportMilestonesToCSV,
  sumCommittedExpensesWei,
} from '../src/services/reportService';

describe('Report Service', () => {
  it('formats research logs into CSV with properly sanitized fields', () => {
    const logs = [
      {
        id: 'log-1',
        title: 'Initial Finding',
        content: 'Found "interesting" results in dataset, section 1.',
        createdAt: '2026-09-12T00:00:00Z',
      },
    ];

    const csv = exportResearchLogsToCSV(logs);
    expect(csv).toContain('Log ID,Title,Content,Created At');
    expect(csv).toContain('"log-1"');
    expect(csv).toContain('"Initial Finding"');
    expect(csv).toContain('"Found ""interesting"" results in dataset, section 1."');
  });

  it('formats expenses ledger into CSV with recipient and wei amounts', () => {
    const expenses = [
      {
        id: 'exp-1',
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amountWei: '1000000000000000000',
        memo: 'Equipment purchase',
        status: 'approved',
        createdAt: '2026-09-12T00:00:00Z',
      },
    ];

    const csv = exportExpensesToCSV(expenses);
    expect(csv).toContain('Expense ID,Recipient Address,Amount (wei),Memo,Status,Created At');
    expect(csv).toContain('"0x1234567890abcdef1234567890abcdef12345678"');
    expect(csv).toContain('"1000000000000000000"');
    expect(csv).toContain('"Equipment purchase"');
  });

  it('formats milestones into CSV with state and proof URI', () => {
    const milestones = [
      {
        id: 'ms-1',
        title: 'Dataset "v2", finalized',
        state: 'approved',
        proofUri: 'https://example.com/proof.json',
        createdAt: '2026-09-12T00:00:00Z',
      },
    ];

    const csv = exportMilestonesToCSV(milestones);
    expect(csv).toContain('Milestone ID,Title,State,Proof URI,Created At');
    expect(csv).toContain('"ms-1"');
    expect(csv).toContain('"Dataset ""v2"", finalized"');
    expect(csv).toContain('"approved"');
    expect(csv).toContain('"https://example.com/proof.json"');
  });

  it('sums committed spend (approved + executed) and skips proposed/failed', () => {
    const total = sumCommittedExpensesWei([
      { id: 'e1', amountWei: '100', status: 'approved' },
      { id: 'e2', amountWei: '200', status: 'executed' },
      { id: 'e3', amountWei: '999', status: 'proposed' },
      { id: 'e4', amountWei: '50', status: 'failed' },
    ]);
    expect(total).toBe('300');
  });

  it('fails loudly on an unparseable audit amount instead of zeroing it', () => {
    expect(() =>
      sumCommittedExpensesWei([{ id: 'e-bad', amountWei: 'not-a-number', status: 'approved' }])
    ).toThrow('e-bad');
  });
});
