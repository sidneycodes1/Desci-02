export interface ValidateSpendRequestParams {
  projectOwnerWallet: string;
  recipientAddress: string;
  proposedAmountWei: string;
  currentOnchainBalanceWei: string;
  memo: string;
}

export interface SpendValidationResult {
  isValid: boolean;
  error?: string;
  code?: 'INVALID_RECIPIENT' | 'INSUFFICIENT_FUNDS' | 'MEMO_TOO_LONG' | 'INVALID_AMOUNT';
}

export interface OnchainExpenseRecord {
  expenseId: number;
  projectId: number;
  proposer: string;
  recipient: string;
  amountWei: string;
  approved: boolean;
  executed: boolean;
}

export interface ReconcileProjectTreasuryParams {
  projectId: string;
  onchainBalanceWei: string;
  onchainBlockNumber: number;
  onchainExpenses?: OnchainExpenseRecord[];
}

export interface ReconcileResult {
  projectId: string;
  previousBalanceWei: string;
  newBalanceWei: string;
  driftDetected: boolean;
  syncedBlock: number;
  syncedAt: string;
}

/**
 * Validates a spend request against on-chain treasury rules & budget state.
 * Never trusts client-submitted amounts — enforces recipient owner check & balance guards.
 */
export function validateSpendRequest(params: ValidateSpendRequestParams): SpendValidationResult {
  const { projectOwnerWallet, recipientAddress, proposedAmountWei, currentOnchainBalanceWei, memo } = params;

  // 1. Recipient check: Must equal project owner wallet address
  if (recipientAddress.toLowerCase() !== projectOwnerWallet.toLowerCase()) {
    return {
      isValid: false,
      code: 'INVALID_RECIPIENT',
      error: `Recipient address ${recipientAddress} does not match project owner wallet address ${projectOwnerWallet}`,
    };
  }

  // 2. Amount format check
  let amountBigInt: bigint;
  let balanceBigInt: bigint;
  try {
    amountBigInt = BigInt(proposedAmountWei);
    balanceBigInt = BigInt(currentOnchainBalanceWei);
  } catch {
    return {
      isValid: false,
      code: 'INVALID_AMOUNT',
      error: 'Invalid wei amount string format',
    };
  }

  if (amountBigInt <= 0n) {
    return {
      isValid: false,
      code: 'INVALID_AMOUNT',
      error: 'Spend amount must be strictly greater than 0 wei',
    };
  }

  // 3. Budget guard: Proposed expense cannot exceed current on-chain balance
  if (amountBigInt > balanceBigInt) {
    return {
      isValid: false,
      code: 'INSUFFICIENT_FUNDS',
      error: `Insufficient treasury funds: requested ${proposedAmountWei} wei but project balance is ${currentOnchainBalanceWei} wei`,
    };
  }

  // 4. Memo length check (max 1024 bytes on-chain bound)
  if (Buffer.byteLength(memo, 'utf8') > 1024) {
    return {
      isValid: false,
      code: 'MEMO_TOO_LONG',
      error: 'Expense memo exceeds maximum allowed size of 1024 bytes',
    };
  }

  return { isValid: true };
}

/**
 * Reconciles on-chain treasury state with database cached state.
 * Detects balance drift and produces updated balance record.
 */
export function reconcileProjectTreasuryState(
  previousBalanceWei: string,
  params: ReconcileProjectTreasuryParams
): ReconcileResult {
  const driftDetected = previousBalanceWei !== params.onchainBalanceWei;
  const nowISO = new Date().toISOString();

  return {
    projectId: params.projectId,
    previousBalanceWei,
    newBalanceWei: params.onchainBalanceWei,
    driftDetected,
    syncedBlock: params.onchainBlockNumber,
    syncedAt: nowISO,
  };
}
