# Research Logs (Phase 6)

## Overview

Phase 6 implements research log and progress update entries tied to research projects in the SciAgent Protocol. Researchers can record findings, progress milestones, and attach IPFS evidence uploads (e.g. PDFs, lab notes, raw datasets) uploaded via Pinata IPFS storage.

## Key Features

1. **Structured Log Entries**: Each entry contains a title, markdown/plain content, author metadata, evidence CID, MIME type, file size, and creation/update timestamps.
2. **Access & Permission Scoping**:
   - **Read Access**: Visible to project owner and registered project collaborators.
   - **Write Access**: Project owners and active collaborators can publish research logs.
   - **Delete Access**: Soft-delete restricted to the log author, project owner, or system admin.
3. **Storage & Validation System**:
   - Server-side validation of file type and size before IPFS pinning.
   - Evidence uploaded to Pinata IPFS storage using `@sciagent/shared/storage/pinata`.

## Evidence Upload & Storage Rules

### Allowed File Types

- `application/pdf` (Research papers, reports)
- `image/png`, `image/jpeg` (Spectra, charts, lab photos)
- `application/json` (Raw data, experimental parameters)
- `text/plain`, `text/markdown` (Code snippets, notes)

### File Constraints

- **Max File Size**: 10 MB (10,485,760 bytes)
- **Title Length**: 1 - 200 characters
- **Content Length**: 1 - 50,000 characters

## API Routes

### GET `/api/projects/[id]/logs`

List all active research logs for a project in reverse chronological order.

### POST `/api/projects/[id]/logs`

Create a new research log for a project.

**Payload:**

```json
{
  "title": "Synthesis Results for Compound A-42",
  "content": "Full NMR spectrum confirms structure...",
  "evidenceCid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  "evidenceMimeType": "application/pdf",
  "evidenceSizeBytes": 512000
}
```

### GET `/api/projects/[id]/logs/[logId]`

Fetch details of a single research log entry.

### DELETE `/api/projects/[id]/logs/[logId]`

Soft delete a research log entry (`deleted_at` set).

## Security & Database Scoping

- **Supabase RLS**: Enabled on `research_logs` table (DDL in `0002_blue_mulholland_black.sql`, policies in `0003_research_logs_rls.sql`).
- **User Scoping**: User authorization enforced using `createSupabaseClientFromToken()` with the user's JWT session.
- **Data Retention**: Soft-delete preserves audit trails for grant compliance.
