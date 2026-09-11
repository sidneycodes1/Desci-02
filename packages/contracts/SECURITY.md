# SciAgent Contracts — Security

## Phase 4: Authentication (Privy)

### Scope

`@sciagent/auth` package — Privy JWT verification, role-based access
control (RBAC), Next.js middleware, Supabase RLS policy generation.
Privy v1.32 via `@privy-io/server-auth`. No proxy:
all contracts and auth logic are immutable (confirmed Phase 3/4).

### Architecture

```
Privy client → Privy JWT (ES256) → @privy-io/server-auth verifyAuthToken
→ Session + AuthUser → Supabase RLS (auth.uid()) → Contract calls
```

### Assumptions

1. **Privy is the identity provider.** JWTs are signed by Privy's
   verification key; `verifyAuthToken` validates ES256 signature,
   issuer (`privy.io`), and audience (`appId`).
2. **Roles stored in Privy custom metadata** under key `sciagent_role`.
   Compromised metadata key = compromised roles.
3. **Server-side verification only.** Private key (`PRIVY_APP_SECRET`)
   never touches the browser; all JWT validation is server-side.
4. **Supabase RLS enforces row-level security.** `auth.uid()` returns
   the Privy JWT `sub` claim via `request.jwt.claim.sub`.
5. **`auth.uid()` is a Supabase function** mapping the JWT sub/sid to
   the authenticated user — RLS policies must use it consistently.

### Trust boundaries

| Boundary | Rule enforced |
|---|---|
| Privy JWT issuance | Privy signs; server verifies with SPKI + ES256 |
| Session verification | `@privy-io/server-auth.verifyAuthToken` validates sig/iss/aud |
| Role assignment | `customMetadata.sciagent_role`; resolved via `resolveRole()` |
| Route protection | Next.js middleware + `createAuthMiddleware()` checks Bearer token |
| Supabase RLS | `auth.uid()` = JWT `sub`; policies scoped to owner/admin |
| API routes | Bearer token required for all `/api/*` except `/api/auth` and `/api/health` |

### Fund-movement safety

- `GrantTreasury.executeExpense` is called with the authenticated
  user's wallet — role checks (proposer/approver) still enforced on-chain.
- Privy auth gates **who can call**; Solidity access control gates
  **what they can do**. Both layers must pass.
- `auth.uid()` is derived from the Privy JWT `sub` claim — a forged
  JWT would need the Privy private key.

### Known limitations (accepted)

1. **Privy is the single identity source.** Account compromise = full access.
   Mitigation: Privy security controls + monitoring.
2. **Role stored in custom metadata.** Metadata changes require Privy API.
   A compromised metadata key grants role escalation.
3. **`auth.uid()` relies on Supabase JWT parsing.** If Supabase changes
   its JWT claim mapping, RLS policies break silently.
4. **No on-chain session revocation.** If a session is compromised,
   `invalidateSession` deletes the Privy user — but on-chain state
   remains until next transaction.
5. **Middleware protects API routes only.** Static pages and client-side
   navigation are not protected; rely on client-side guards.
6. **`PRIVY_APP_SECRET` is server-only but loaded at runtime.**
   Rotation requires a deploy.

### What an audit should focus on

1. `@privy-io/server-auth` `verifyAuthToken` integration — SPKI loading,
   issuer/audience validation, token expiry handling.
2. Role assignment via Privy custom metadata — where/how is the role
   set? Is it mutable by users?
3. `auth.uid()` Supabase function — does it correctly map JWT `sub`
   to the authenticated user across all tables?
4. Next.js middleware — does it correctly extract and validate the
   Bearer token for all protected routes?
5. RLS policy coverage — are all user/financial tables covered by
   policies? Any tables missing RLS?
6. Key rotation procedure for `PRIVY_APP_SECRET`.

---

## Phase 3

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
