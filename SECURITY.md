# SciAgent Protocol — Comprehensive Security & Audit Specification

## Executive Summary

SciAgent Protocol incorporates multi-layered defense-in-depth security controls spanning smart contract architectures, database Row-Level Security (RLS) policies, API authorization guards, and input sanitization to safeguard research funds and intellectual property.

---

## 1. Smart Contract Protections (`@sciagent/contracts`)

- **Reentrancy Protection**: All fund disbursements and withdrawal methods utilize OpenZeppelin `ReentrancyGuard` and strict **Checks-Effects-Interactions** sequencing.
- **Access Control & Roles**: `ProjectRegistry`, `GrantTreasury`, `MilestoneRegistry`, and `ReputationRegistry` restrict state-mutating methods to verified project owners, registered executors, or protocol admins.
- **Memo Length Caps**: All expense proposals enforce a strict 1024-byte maximum memo limit (`MAX_MEMO_LENGTH` on-chain, `MAX_MEMO_BYTES` in app validation) to prevent gas-exhaustion payload attacks.
- **Pausable Emergency Brakes**: Emergency pause guards allow immediate freezing of contracts in case of security anomalies.

---

## 2. Database & Row-Level Security (`@sciagent/database`)

- **PostgreSQL RLS Policies**: All 11 database tables (`users`, `wallets`, `projects`, `project_collaborators`, `milestones`, `research_logs`, `expenses`, `treasury_balances`, `reputation_events`, `reputation_scores`, `ai_agent_runs`) enforce RLS policies scoped to `auth.uid()`.
- **User & Tenant Isolation**: Unauthenticated queries are rejected. Collaborators are restricted to assigned projects.
- **Soft Deletions**: Deletions update `deleted_at` timestamps to maintain an immutable audit trail of historical operations.

---

## 3. API & Web Application Security (`apps/web`)

- **Session Authorization**: All API endpoints verify Bearer JWT tokens via `@sciagent/auth/session`.
- **Strict Input Validation**: Zod schemas validate all incoming payload parameters.
- **CSV Injection Defense**: Export formatters automatically double-quote escape strings to prevent formula injection in spreadsheet viewers.
