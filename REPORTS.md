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
