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
 * Sanitizes string values for safe CSV output.
 */
function sanitizeCSVField(val: string): string {
  if (val === null || val === undefined) return '""';
  const escaped = String(val).replace(/"/g, '""');
  return `"${escaped}"`;
}
