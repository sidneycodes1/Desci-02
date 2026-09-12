# Milestone Workflow & Fund Release Specification

## Overview

SciAgent Protocol includes a verified milestone lifecycle to manage decentralized research deliverables, peer-review submissions, and automated treasury fund disbursements upon milestone approval.

---

## State Machine Definition

A milestone progresses through four strict states:

```
[created] ---> (submit proof) ---> [submitted] ---> (approve) ---> [approved] (Terminal State)
                                         |
                                         +-------> (reject) ---> [rejected]
                                                                     |
                                                                     +---> (resubmit proof) ---> [submitted]
```

### Valid State Transitions

1. **`created` -> `submitted`**: Milestone creator or project owner submits a valid IPFS/HTTP proof URL (`proofUri`).
2. **`submitted` -> `approved`**: Project owner or protocol admin reviews proof, approves the milestone, and optionally triggers an automated treasury fund payout.
3. **`submitted` -> `rejected`**: Project owner or protocol admin rejects submission with a mandatory rejection reason string.
4. **`rejected` -> `submitted`**: Milestone creator or project owner re-submits updated proof details.
5. **`approved` (Terminal)**: Once approved, the milestone state is locked and immutable. Any further state transition attempts revert with `ALREADY_APPROVED`.

---

## Role & Permission Rules

| Action | Allowed Roles |
|---|---|
| Create Milestone | Project Owner, Admin |
| Submit Proof | Milestone Creator, Project Owner, Admin |
| Approve Milestone | Project Owner, Admin |
| Reject Milestone | Project Owner, Admin |

---

## Fund Release Trigger Mechanism

When approving a milestone, the approver can specify an optional `releaseAmountWei` payout:

1. **Budget Check**: The system validates that `releaseAmountWei <= currentOnchainBalanceWei` of the project treasury. If the release amount exceeds available funds, the approval fails with code `INSUFFICIENT_TREASURY_FUNDS`.
2. **Expense Record**: Upon successful approval, the protocol automatically generates an approved expense record assigned to the project owner's wallet address.
3. **On-chain Disbursement**: Integrates with `@sciagent/contracts` `Treasury.sol` / `SpendingLimits.sol` for automated contract execution.

---

## API Endpoints Summary

- `GET /api/projects/[id]/milestones` — List milestones for project.
- `POST /api/projects/[id]/milestones` — Create new milestone (state: `created`).
- `POST /api/projects/[id]/milestones/[milestoneId]/submit` — Submit proof URL (state: `submitted`).
- `POST /api/projects/[id]/milestones/[milestoneId]/approve` — Approve milestone & trigger fund release (state: `approved`).
- `POST /api/projects/[id]/milestones/[milestoneId]/reject` — Reject milestone with reason (state: `rejected`).
