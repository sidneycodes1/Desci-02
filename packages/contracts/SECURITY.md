# SciAgent Contracts — Security (Phase 3)

## Scope

`ProjectRegistry`, `GrantTreasury`, `MilestoneRegistry`,
`ReputationRegistry`, plus `ProtocolRoles`, `ProtocolErrors`,
`IProjectRegistry`, `script/Deploy.s.sol`. Solidity 0.8.26, OpenZeppelin
5.x (`AccessControl`, `Pausable`, `ReentrancyGuard`). No proxies:
**all contracts are immutable** (confirmed Phase 3 decision).

## Assumptions

1. The deployer admin is trusted at construction and delegates roles to
   multisigs/modules afterwards. A compromised admin key owns the system
   (can pause, grant roles, approve/grade everything).
2. `ProjectRegistry` is the root of trust: every module validates project
   existence/ownership against it. Its address is immutable per contract.
3. ETH is the only treasury asset. No ERC-20 path exists.
4. Off-chain indexers (Phase 7) reconcile `projectBalances` and expense
   states; the chain is the source of truth on drift.
5. Reputation scores are advisory, never gate funds.

## Trust boundaries

| Boundary                                  | Rule enforced on-chain                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Project creation                          | `PROJECT_CREATOR_ROLE` only                                                                          |
| Expense proposal                          | project owner or `TREASURY_PROPOSER_ROLE`; recipient **must equal** project owner; memo ≤ 1024 bytes |
| Expense approval                          | `TREASURY_APPROVER_ROLE` only, exactly once                                                          |
| Expense execution                         | **proposer or approver only**; approved + unexecuted + funded                                        |
| Milestone creation                        | project owner or `MILESTONE_CREATOR_ROLE`                                                            |
| Proof submission                          | milestone creator, project owner, or creator-role                                                    |
| Milestone approval                        | `MILESTONE_APPROVER_ROLE` only, requires Submitted state                                             |
| Reputation writes                         | `REPUTATION_ORACLE_ROLE` only                                                                        |
| Pause/unpause (all)                       | `DEFAULT_ADMIN_ROLE` only                                                                            |
| Reads (`get*`, `exists`, `totalProjects`) | open, no auth (no sensitive data)                                                                    |

## Fund-movement safety

- `executeExpense` follows checks-effects-interactions (balance debit +
  `executed` flag before the external call) **and** `nonReentrant`.
  Proven by `testReentrantRecipientCannotDoubleSpend`: a malicious
  owner-recipient reentering from `receive()` is blocked, single payout.
- Failed recipient calls revert the whole execution
  (`ExpenseExecutionFailed`); the expense stays approved-but-unexecuted
  and is retryable — no funds lock, but a hostile/broken recipient can
  grief execution (retry after fixing recipient is impossible: recipient
  is immutable — see limitations).
- `receive()` always reverts: no accidental direct funding; `deposit()`
  is the only credit path and requires an existing project + non-zero value.
- Double-spend is closed on three sides: `executed` flag, balance debit
  before call, reentrancy guard.

## Known limitations (accepted)

1. **Immutable, no upgrade path.** Bugs require redeploy + migration.
   No storage gaps, no proxy admin.
2. **Owner-only recipients.** Payouts go solely to the project owner;
   vendor-direct payment is intentionally impossible (Phase 1.5 decision).
3. **Griefing via failing recipient.** A recipient contract whose
   fallback reverts (or runs out of gas — full gas is forwarded) blocks
   that expense permanently; mitigation is social (owner-controlled
   recipient), not on-chain.
4. **Unbounded iteration absent, but memo storage scales with length**
   up to the 1024-byte cap (`proposeExpense` max measured ~308k gas).
5. **Centralized roles at deploy.** Admin holds every role until
   delegation; compromise before delegation is total.
6. **No rate limits / daily caps** on deposits, proposals, or executions.
7. **Reputation is oracle-trust.** Any oracle can mint/burn arbitrary
   points for any subject; scores are advisory only.
8. **Timestamps are miner-malleable** (±seconds); only used for audit
   fields, never for fund logic.

## Gas reference (forge, avg over suite)

| Function             | Avg   | Max                    |
| -------------------- | ----- | ---------------------- |
| `deposit`            | ~48k  | ~56k                   |
| `proposeExpense`     | ~178k | ~308k (1024-byte memo) |
| `approveExpense`     | ~70k  | ~77k                   |
| `executeExpense`     | ~63k  | ~112k                  |
| `createProject`      | ~162k | ~173k                  |
| `createMilestone`    | ~153k | ~220k                  |
| `submitProof`        | ~63k  | ~84k                   |
| `approveMilestone`   | ~50k  | ~60k                   |
| `addReputationEvent` | ~164k | ~236k                  |

Deployments: Treasury ~1.48M, Milestones ~1.44M, Reputation ~1.03M,
Projects ~0.93M gas.

## What an audit should focus on

1. `GrantTreasury.executeExpense`: authorization predicate, CEI order,
   gas forwarding to arbitrary (owner) contracts.
2. Role-grant flow in `Deploy.s.sol` and any future delegation scripts.
3. `MilestoneRegistry.submitProof` permission disjunction
   (creator/owner/role) — confirm it matches the intended reviewer model.
4. Reentrancy surfaces beyond `executeExpense` (none move funds, but
   verify state-write ordering in propose/approve paths).
5. Denial-of-service via malicious `metadataURI`/`memo` lengths on L2
   calldata pricing (cap exists for memo only).
6. Anything that changes immutability assumptions (future proxy work
   invalidates this note).
