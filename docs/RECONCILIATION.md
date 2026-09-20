# Treasury & Chain/DB Reconciliation Strategy (Phase 7)

## Executive Summary

Phase 7 connects the SciAgent Protocol app layer to the `GrantTreasury.sol` smart contract. The on-chain contract holds ETH grant funds and enforces spend rules. To maintain low-latency query performance while guaranteeing strict financial integrity, SciAgent Protocol implements an explicit **Chain/DB Reconciliation Model**.

---

## Source of Truth & Architecture

```
[GrantTreasury.sol Smart Contract]
       (Canonical Source of Truth for ETH Balances & Executed Payouts)
                       │
                       ▼ On-Chain Sync & Reconciliation
          [packages/shared/src/services/treasuryService.ts]
                       │
                       ▼ Cached Query State & Audit Trail
         [PostgreSQL / Supabase (treasury_balances & expenses)]
```

### Roles & Responsibilities

1. **On-Chain Smart Contract (`GrantTreasury.sol`)**:
   - Primary canonical ledger of project ETH balances.
   - Enforces payout recipient constraints (must equal project owner).
   - Enforces max memo byte size (1024 bytes).
   - Enforces execution access controls and checks-effects-interactions non-reentrancy protection.

2. **Database Cache Layer (`treasury_balances` & `expenses`)**:
   - `treasury_balances`: Cached on-chain balance per project (`onchain_balance_wei`), last synced block (`last_synced_block`), and timestamp (`last_synced_at`).
   - `expenses`: Off-chain database mirror of expense lifecycle (`proposed` $\rightarrow$ `approved` $\rightarrow$ `executed`). **Financial audit trail: rows are never soft-deleted or removed**.

---

## Protection Against Client-Submitted Amounts & Double-Spends

1. **Never Trust Client Amounts**:
   - Every spend proposal submitted to `POST /api/projects/[id]/expenses` is validated server-side using `validateSpendRequest()`.
   - The requested amount in wei is checked against the current project balance (`onchain_balance_wei` in `treasury_balances` or on-chain state).
   - Spend requests exceeding available treasury balance are rejected with HTTP 400 (`INSUFFICIENT_FUNDS`).

2. **Recipient Wallet Validation**:
   - The payout recipient address is verified server-side to match the project owner's registered wallet address before accepting the proposal.

3. **Memo Gas-Griefing Limit**:
   - Memos are checked against the on-chain limit of 1024 bytes.

---

## Reconciliation Strategy & Drift Handling

### Handling Chain/DB Drift

Drift can occur when:
- Direct ETH deposits arrive on-chain via `GrantTreasury.deposit()`.
- On-chain executions change project balances independently of web requests.
- Block re-organizations occur during high network congestion.

### Reconciliation Resolution Flow

When `POST /api/projects/[id]/treasury/reconcile` is invoked (or by background sync tasks):
1. Fetch latest on-chain `projectBalances(projectId)` and block number.
2. Compare with cached `onchain_balance_wei` in `treasury_balances`.
3. If `driftDetected` is true:
   - Log reconciliation event for audit tracking.
   - Atomically update `treasury_balances` with new balance, `last_synced_block`, and `last_synced_at`.
   - Reconcile expense status flags (`proposed`, `approved`, `executed`) against smart contract state.

---

## API Routes

- `GET /api/projects/[id]/treasury`: Get cached project balance and sync metadata.
- `POST /api/projects/[id]/treasury/reconcile`: Trigger chain sync & reconciliation.
- `GET /api/projects/[id]/expenses`: List proposed/approved/executed expenses.
- `POST /api/projects/[id]/expenses`: Submit spend request with server-side validation.
