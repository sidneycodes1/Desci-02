# SciAgent AI Agents Architecture & Queue System

## Overview

The `@sciagent/agents` package delivers an autonomous background AI agent suite for evaluating decentralized research projects, monitoring treasury spending compliance, verifying milestone deliverables, and orchestrating protocol-wide project health scores.

---

## Agent Architecture & Components

```
                     +---------------------------------------+
                     |    SciAgent Orchestrator Agent        |
                     +---------------------------------------+
                                        |
       +--------------------------------+--------------------------------+
       |                                |                                |
       v                                v                                v
+----------------------+     +----------------------+     +----------------------+
|    Tracker Agent     |     |    Spending Agent    |     |   Milestone Agent    |
| (Activity Scoring)   |     | (Treasury Compliance)|     | (Deliverable Proof)  |
+----------------------+     +----------------------+     +----------------------+
```

### 1. Tracker Agent (`trackerAgent.ts`)
- **Purpose**: Evaluates research output velocity, research log update frequency, recency metrics, and team collaboration.
- **Scoring**: Computes `activityScore` (0 - 100) and categorizes project activity state (`active`, `stale`, or `dormant`).
- **Recommendations**: Generates actionable advisories for research leads to keep projects active.

### 2. Spending Agent (`spendingAgent.ts`)
- **Purpose**: Assesses treasury burn rate risk, checks expense commitments against available balance, and flags pending on-chain transaction reconciliations.
- **Advisories**: Issues alerts for high burn rates (`expenses > balance`), pending approval backlogs, or un-reconciled wallet transactions.

### 3. Milestone Agent (`milestoneAgent.ts`)
- **Purpose**: Verifies milestone proof payloads (`proofUri`), checks IPFS/HTTP format validity, and produces a verification score prior to milestone funding release.
- **Security Guard**: Ensures only valid proof URIs can trigger automated release triggers.

### 4. Orchestrator Agent (`orchestrator.ts`)
- **Purpose**: Combines inputs across Tracker, Spending, and Milestone agents to compute a unified **Project Health Index (0 - 100)** and executive summary.

---

## Async Queue System (`queue.ts`)

- **Queue Infrastructure**: Supports BullMQ / Redis worker queue connections in production environments with automatic fallback to an in-memory worker queue in local/test environments.
- **Task Handlers**: Asynchronously queues background jobs (`pending` -> `processing` -> `completed` / `failed`) for long-running verification or periodic project monitoring.
