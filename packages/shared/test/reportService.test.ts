import { describe, expect, it } from 'vitest';
import {
  exportResearchLogsToCSV,
  exportExpensesToCSV,
} from '../services/reportService';

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
});
