# Data Export & Reports Specification

## Overview

SciAgent Protocol supports exporting research data, treasury expense ledgers, milestone histories, and project activity metrics in structured CSV and JSON report formats.

---

## Supported Export Endpoints

`GET /api/projects/[id]/export`

### Query Parameters

| Parameter | Type | Default | Options | Description |
|---|---|---|---|---|
| `format` | string | `json` | `json`, `csv` | Export file format. |
| `section` | string | `all` | `all`, `logs`, `expenses`, `milestones` | Filter exported dataset section. |

---

## CSV Export Structure

CSV output includes RFC 4180 compliant double-quote escaping to prevent CSV injection:

```csv
Log ID,Title,Content,Created At
"log-1","Phase 1 Observations","Observed 15% increase in throughput","2026-09-12T00:00:00Z"
```

```csv
Expense ID,Recipient Address,Amount (wei),Memo,Status,Created At
"exp-1","0xOwnerWallet...","1000000000000000000","Milestone payout","approved","2026-09-12T00:00:00Z"
```

---

## JSON Report Payload

Returns full project state, treasury balance snapshot, milestone review histories, and raw research log entries.

### Section filtering

`section` filters which datasets are returned — unrequested datasets are
**omitted** (no key), never emptied, so callers can distinguish "not
requested" from "requested but empty":

- `all` (default): everything below.
- `logs`: `project` + `logs`.
- `expenses`: `project` + `treasury` + `expenses`.
- `milestones`: `project` + `milestones`.

CSV behaves the same way: `section=milestones` returns the milestones ledger
(`Milestone ID,Title,State,Proof URI,Created At`), and `section=all`
concatenates all three ledgers under `=== RESEARCH LOGS ===`,
`=== EXPENSES LEDGER ===`, `=== MILESTONES ===` headers.

### Treasury summary semantics

- `treasury.onchainBalanceWei`: cached on-chain balance (`treasury_balances`).
- `treasury.totalExpensesWei`: sum of `amount_wei` over expenses with status
  `approved` or `executed` (committed spend). `proposed` expenses are listed
  but excluded; `failed` are excluded.
- `treasury.expenseCount`: number of expense rows included in the export.

### Failure behavior

A dataset that fails to load fails the whole export with HTTP 500 naming the
section (`Failed to export expenses ledger`, etc.). Sections are never
silently emptied — note `expenses` has no `deleted_at` column by design
(immutable audit trail), so it must not be soft-delete-filtered.
