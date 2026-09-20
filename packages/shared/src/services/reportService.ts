export interface ProjectReportData {
  project: {
    id: string;
    title: string;
    description: string;
    state: string;
    ownerUserId: string;
    createdAt: string;
  };
  treasury: {
    onchainBalanceWei: string;
    totalExpensesWei: string;
    expenseCount: number;
  };
  milestones: Array<{
    id: string;
    title: string;
    state: string;
    proofUri?: string | null;
    createdAt: string;
  }>;
  logs: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }>;
  expenses: Array<{
    id: string;
    recipientAddress: string;
    amountWei: string;
    memo: string;
    status: string;
    createdAt: string;
  }>;
}

/**
 * Converts project research logs to CSV format.
 */
export function exportResearchLogsToCSV(logs: ProjectReportData['logs']): string {
  const headers = ['Log ID', 'Title', 'Content', 'Created At'];
  const rows = logs.map((log) => [
    sanitizeCSVField(log.id),
    sanitizeCSVField(log.title),
    sanitizeCSVField(log.content),
    sanitizeCSVField(log.createdAt),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Converts project expenses ledger to CSV format.
 */
export function exportExpensesToCSV(expenses: ProjectReportData['expenses']): string {
  const headers = ['Expense ID', 'Recipient Address', 'Amount (wei)', 'Memo', 'Status', 'Created At'];
  const rows = expenses.map((exp) => [
    sanitizeCSVField(exp.id),
    sanitizeCSVField(exp.recipientAddress),
    sanitizeCSVField(exp.amountWei),
    sanitizeCSVField(exp.memo),
    sanitizeCSVField(exp.status),
    sanitizeCSVField(exp.createdAt),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Converts project milestones to CSV format.
 */
export function exportMilestonesToCSV(milestones: ProjectReportData['milestones']): string {
  const headers = ['Milestone ID', 'Title', 'State', 'Proof URI', 'Created At'];
  const rows = milestones.map((ms) => [
    sanitizeCSVField(ms.id),
    sanitizeCSVField(ms.title),
    sanitizeCSVField(ms.state),
    sanitizeCSVField(ms.proofUri ?? ''),
    sanitizeCSVField(ms.createdAt ?? ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Expense statuses that count as committed spend in treasury summaries.
 * `proposed` is not money moved; `failed` never moved.
 */
const COMMITTED_EXPENSE_STATUSES = new Set(['approved', 'executed']);

/**
 * Sums committed expense amounts (wei, as a decimal string) for export
 * treasury summaries. Throws on an unparseable amount — a corrupt row in the
 * financial audit trail must fail the export loudly, never silently zero.
 */
export function sumCommittedExpensesWei(
  expenses: Array<{ id: string; amountWei: string; status: string }>
): string {
  let total = 0n;
  for (const exp of expenses) {
    if (!COMMITTED_EXPENSE_STATUSES.has(exp.status)) continue;
    try {
      total += BigInt(exp.amountWei);
    } catch {
      throw new Error(`unparseable amount_wei on expense ${exp.id}: ${exp.amountWei}`);
    }
  }
  return total.toString();
}

/**
 * Sanitizes string values for safe CSV output.
 */
function sanitizeCSVField(val: string): string {
  if (val === null || val === undefined) return '""';
  const escaped = String(val).replace(/"/g, '""');
  return `"${escaped}"`;
}
