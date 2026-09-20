/**
 * Shared workspace helpers — the single contract between UI, backend, and tests.
 *
 * The project workspace page (`app/projects/[id]/page.tsx`), the export API
 * (`app/api/projects/[id]/export/route.ts`), and the contract tests
 * (`lib/__tests__/workspace-contract.test.ts`) must all agree on:
 *  - export URLs / query params (validated by `exportReportQuerySchema`)
 *  - CSV section headers (`=== RESEARCH LOGS ===`, etc.)
 *  - wei formatting and committed-spend totals
 *  - who is allowed to create projects / propose expenses
 *
 * Keep this file pure (no React, no fetch) so Vitest can import it in node.
 */

export type WorkspaceRole = 'admin' | 'owner' | 'member' | 'viewer';
export type ExportFormat = 'csv' | 'json';
export type ExportSection = 'all' | 'logs' | 'expenses' | 'milestones';

export const EXPORT_CSV_HEADERS = {
  logs: '=== RESEARCH LOGS ===',
  expenses: '=== EXPENSES LEDGER ===',
  milestones: '=== MILESTONES ===',
} as const;

export const EXPORT_JSON_KEYS: Record<ExportSection, string[]> = {
  all: ['project', 'treasury', 'expenses', 'milestones', 'logs'],
  logs: ['project', 'logs'],
  expenses: ['project', 'treasury', 'expenses'],
  milestones: ['project', 'milestones'],
};

/** Build the export URL the workspace UI must call — backend validates the same params. */
export function buildExportUrl(
  projectId: string,
  format: ExportFormat = 'csv',
  section: ExportSection = 'all'
): string {
  return `/api/projects/${projectId}/export?format=${format}&section=${section}`;
}

/** Split a `section=all` CSV export into its three ledger sections. */
export function parseCsvSections(csv: string): {
  logs: string;
  expenses: string;
  milestones: string;
} {
  const logsIdx = csv.indexOf(EXPORT_CSV_HEADERS.logs);
  const expensesIdx = csv.indexOf(EXPORT_CSV_HEADERS.expenses);
  const milestonesIdx = csv.indexOf(EXPORT_CSV_HEADERS.milestones);
  const slice = (from: number, to: number) =>
    from === -1 ? '' : csv.slice(from, to === -1 ? undefined : to).trim();
  return {
    logs: slice(logsIdx, expensesIdx),
    expenses: slice(expensesIdx, milestonesIdx),
    milestones: slice(milestonesIdx, -1),
  };
}

/** Format a wei string as ETH with 4 decimals. Returns '—' when unavailable. */
export function formatWeiToEth(wei?: string | null): string {
  if (!wei) return '—';
  try {
    const weiBig = BigInt(wei);
    const whole = weiBig / 10n ** 18n;
    const frac = (weiBig % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
    return `${whole.toString()}.${frac} ETH`;
  } catch {
    return '—';
  }
}

export interface ExpenseLike {
  amountWei: string;
  status: string;
}

const COMMITTED_STATUSES = new Set(['approved', 'executed']);

/**
 * Frontend mirror of `sumCommittedExpensesWei` (reportService).
 * Proposed/failed expenses are listed but excluded from totals.
 */
export function sumCommittedExpensesWei(expenses: ExpenseLike[]): string {
  let total = 0n;
  for (const exp of expenses) {
    if (!COMMITTED_STATUSES.has(exp.status)) continue;
    total += BigInt(exp.amountWei);
  }
  return total.toString();
}

/**
 * Plan §09 auth migration: ANY authenticated wallet can create a project
 * and becomes its owner. The global Privy role no longer gates creation —
 * it gates platform admin endpoints only. Kept as a function (not a const)
 * so call sites + tests share the rule.
 */
export function canCreateProject(_role?: WorkspaceRole): boolean {
  return true;
}

export function canProposeExpense(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export interface RoleGuidance {
  canCreate: boolean;
  badge: string;
  message: string;
}

/** Single source of truth for the create entry-point copy (plan §02). */
export function getCreateProjectGuidance(role: WorkspaceRole): RoleGuidance {
  return {
    canCreate: true,
    badge: role.toUpperCase(),
    message:
      'Any logged-in wallet can create a project and becomes its owner. Edit stays invited-only per project.',
  };
}

/** Step-by-step onboarding shown on both the homepage and the workspace. */
export const WORKSPACE_STEPS = [
  {
    step: 1,
    title: 'Create a project',
    detail: 'Feed → New → Project. You become its owner. You land on /projects/[id].',
  },
  {
    step: 2,
    title: 'Add logs, milestones, expenses',
    detail: 'Use the Research Logs, Milestones, and Treasury tabs in the workspace.',
  },
  {
    step: 3,
    title: 'Export the audit ledger',
    detail:
      'Open Reports & Export → pick a section → Download CSV Ledger (check === EXPENSES LEDGER === and === MILESTONES ===) or View JSON Report (check treasury.totalExpensesWei).',
  },
] as const;
