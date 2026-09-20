/**
 * Workspace UI ↔ backend contract tests (no live creds, pure + service level).
 *
 * The homepage and project workspace page were drifting from the export API:
 * users couldn't find `=== EXPENSES LEDGER ===` / `=== MILESTONES ===` or a
 * nonzero `totalExpensesWei`. This file locks the shared contract in one place:
 *
 * - `lib/workspace.ts` (what the UI renders/calls) agrees with
 *   `reportService` (what the API exports) on headers, totals, and URLs.
 * - Export query params the UI builds pass backend Zod validation.
 * - Role gating copy matches backend enforcement (viewer/member blocked).
 */
import { describe, expect, it } from 'vitest';

import {
  buildExportUrl,
  canCreateProject,
  canProposeExpense,
  EXPORT_CSV_HEADERS,
  formatWeiToEth,
  getCreateProjectGuidance,
  parseCsvSections,
  sumCommittedExpensesWei,
  WORKSPACE_STEPS,
} from '../workspace';
import { exportReportQuerySchema } from '../validation/report';
import {
  exportExpensesToCSV,
  exportMilestonesToCSV,
  exportResearchLogsToCSV,
  sumCommittedExpensesWei as backendSum,
} from '@sciagent/shared/services/reportService';

describe('export URL contract (UI calls what backend validates)', () => {
  it('buildExportUrl output parses under the backend Zod schema', () => {
    for (const format of ['csv', 'json'] as const) {
      for (const section of ['all', 'logs', 'expenses', 'milestones'] as const) {
        const url = buildExportUrl('some-project-id', format, section);
        const query = Object.fromEntries(new URL(url, 'http://localhost').searchParams);
        const parsed = exportReportQuerySchema.safeParse(query);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.format).toBe(format);
          expect(parsed.data.section).toBe(section);
        }
      }
    }
  });

  it('defaults to csv/all like the workspace UI', () => {
    expect(buildExportUrl('pid')).toBe('/api/projects/pid/export?format=csv&section=all');
  });
});

describe('CSV section contract (UI preview labels match backend output)', () => {
  it('backend CSV fixtures contain the headers the UI tells users to find', () => {
    const expensesCsv = exportExpensesToCSV([
      {
        id: 'e1',
        recipientAddress: '0x1111111111111111111111111111111111111111',
        amountWei: '100',
        memo: 'Approved payout',
        status: 'approved',
        createdAt: '2026-09-12T00:00:00Z',
      },
    ]);
    expect(expensesCsv).toContain('Expense ID,Recipient Address,Amount (wei),Memo,Status,Created At');
    expect(expensesCsv).toContain('"Approved payout"');

    const milestonesCsv = exportMilestonesToCSV([
      {
        id: 'm1',
        title: 'Exported Milestone',
        state: 'approved',
        proofUri: null,
        createdAt: '2026-09-12T00:00:00Z',
      },
    ]);
    expect(milestonesCsv).toContain('Milestone ID,Title,State,Proof URI,Created At');

    const logsCsv = exportResearchLogsToCSV([
      { id: 'l1', title: 'Exported Finding', content: 'x', createdAt: '2026-09-12T00:00:00Z' },
    ]);
    expect(logsCsv).toContain('Log ID,Title,Content,Created At');
  });

  it('parseCsvSections splits a section=all file the way the UI preview expects', () => {
    const all = [
      EXPORT_CSV_HEADERS.logs,
      '"l1","Finding","x","2026-09-12"',
      '',
      EXPORT_CSV_HEADERS.expenses,
      '"e1","0xabc","100","Approved payout","approved","2026-09-12"',
      '',
      EXPORT_CSV_HEADERS.milestones,
      '"m1","Exported Milestone","approved","","2026-09-12"',
    ].join('\n');
    const parts = parseCsvSections(all);
    expect(parts.logs).toContain(EXPORT_CSV_HEADERS.logs);
    expect(parts.expenses).toContain('Approved payout');
    expect(parts.milestones).toContain('Exported Milestone');
  });
});

describe('treasury total contract (UI mirrors backend committed-spend rule)', () => {
  const rows = [
    { id: 'a', amountWei: '100', status: 'approved' },
    { id: 'b', amountWei: '200', status: 'executed' },
    { id: 'c', amountWei: '999', status: 'proposed' },
    { id: 'd', amountWei: '50', status: 'failed' },
  ];

  it('frontend helper and backend service agree: proposed/failed excluded', () => {
    expect(sumCommittedExpensesWei(rows)).toBe('300');
    expect(backendSum(rows)).toBe('300');
  });

  it('empty ledger totals zero (not null/crash) so the UI can render it', () => {
    expect(sumCommittedExpensesWei([])).toBe('0');
    expect(backendSum([])).toBe('0');
  });
});

describe('wei formatting contract', () => {
  it('1 ETH renders with 4 decimals', () => {
    expect(formatWeiToEth('1000000000000000000')).toBe('1.0000 ETH');
  });

  it('missing/unparseable input renders an em dash, never throws', () => {
    expect(formatWeiToEth(null)).toBe('—');
    expect(formatWeiToEth(undefined)).toBe('—');
    expect(formatWeiToEth('not-a-number')).toBe('—');
  });
});

describe('permission contract (plan §02 + §09: read universal, edit invited-only)', () => {
  it('any authenticated wallet can create (becomes owner); treasury stays owner/admin', () => {
    expect(canCreateProject('owner')).toBe(true);
    expect(canCreateProject('admin')).toBe(true);
    expect(canCreateProject('member')).toBe(true);
    expect(canCreateProject('viewer')).toBe(true);
    expect(canProposeExpense('member')).toBe(false);
    expect(canProposeExpense('viewer')).toBe(false);
  });

  it('guidance states open creation (no Privy dashboard trip)', () => {
    const g = getCreateProjectGuidance('viewer');
    expect(g.canCreate).toBe(true);
    expect(g.message).toMatch(/Any logged-in wallet can create/);
    expect(getCreateProjectGuidance('owner').canCreate).toBe(true);
  });

  it('onboarding steps point at the real workspace flow', () => {
    expect(WORKSPACE_STEPS).toHaveLength(3);
    expect(WORKSPACE_STEPS[2].detail).toMatch(/Reports & Export/);
    expect(WORKSPACE_STEPS[2].detail).toMatch(/totalExpensesWei/);
  });
});
