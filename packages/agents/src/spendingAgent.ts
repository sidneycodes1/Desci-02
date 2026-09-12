import { SpendingInput, SpendingOutput } from './types';

/**
 * SciAgent Spending Agent
 * Evaluates project expense metrics, budget utilization, and on-chain reconciliation alerts.
 */
export function analyzeProjectSpending(input: SpendingInput): SpendingOutput {
  const { projectId, treasuryBalanceWei, totalExpensesWei, pendingExpensesCount, unreconciledCount } = input;

  let balanceBigInt = 0n;
  let expensesBigInt = 0n;
  try {
    balanceBigInt = BigInt(treasuryBalanceWei);
  } catch {
    balanceBigInt = 0n;
  }

  try {
    expensesBigInt = BigInt(totalExpensesWei);
  } catch {
    expensesBigInt = 0n;
  }

  let healthScore = 80;
  let burnRateRisk: SpendingOutput['burnRateRisk'] = 'low';

  // Check spend relative to treasury
  if (expensesBigInt > balanceBigInt && balanceBigInt > 0n) {
    burnRateRisk = 'high';
    healthScore -= 40;
  } else if (expensesBigInt > (balanceBigInt * 7n) / 10n && balanceBigInt > 0n) {
    burnRateRisk = 'medium';
    healthScore -= 20;
  }

  // Pending expenses penalty
  if (pendingExpensesCount > 3) {
    healthScore -= 15;
  }

  // Unreconciled transaction penalty
  const reconciliationNeeded = unreconciledCount > 0;
  if (reconciliationNeeded) {
    healthScore -= unreconciledCount * 10;
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let advisory = 'Treasury spending is within normal risk parameters.';
  if (burnRateRisk === 'high') {
    advisory = 'High burn rate alert: Total expense commitments exceed available treasury balance.';
  } else if (reconciliationNeeded) {
    advisory = `Attention needed: ${unreconciledCount} pending on-chain transaction(s) require reconciliation.`;
  } else if (pendingExpensesCount > 0) {
    advisory = `Project has ${pendingExpensesCount} pending expense proposal(s) awaiting review.`;
  }

  return {
    projectId,
    burnRateRisk,
    reconciliationNeeded,
    advisory,
    healthScore,
    analyzedAt: new Date().toISOString(),
  };
}
