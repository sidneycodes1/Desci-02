# SciAgent Protocol — Dashboard & UI Design System

## Overview

The `@sciagent/ui` package and Next.js frontend (`apps/web`) provide a modern, glassmorphic sci-fi workspace for decentralized research governance, project administration, research log entries, milestone verification, and AI risk analytics.

---

## API Integration Architecture

All UI pages (`app/page.tsx` and `app/projects/[id]/page.tsx`) connect directly to backend API routes (`/api/projects/**`, `/api/notifications`, `/api/user/profile`) via **TanStack React Query** (`useQuery`, `useMutation`).

- **Real Data Fetching**: Project overview, research log entries, milestone submissions, and treasury expense ledgers are retrieved live from database API endpoints. No mock data fallbacks - all data comes from the real database.
- **Mutations & Cache Invalidation**: Form submissions (project creation, log posting, milestone creation, expense proposals) dispatch real HTTP `POST` requests and automatically invalidate Query cache to update UI state from the database.
- **Authentication**: All API calls send a Bearer session token via the centralized dev helper (`lib/dev-auth.ts`). This is still the `mock_session_token_dev` placeholder — see `KNOWN_LIMITATIONS.md` §3; it must be replaced with the real Privy `getAccessToken()` flow before production.

---

## Design System (`@sciagent/ui`)

- **`Button`**: Primary, Secondary, Glass, Danger, and Outline buttons with micro-animations and loading spinners.
- **`Card`**: Glassmorphic panels with backdrop blur and border highlighting.
- **`Badge`**: Status indicators for project state (`active`, `stale`, `approved`, `pending`, `rejected`).
- **`Input`**: Dark-themed input with cyan focus glow borders.
- **`Modal`**: Glassmorphic dialog overlay.
- **`Spinner`**: Animated SVG loading indicator.

---

## Page Routes Summary

1. `GET /` — **Projects Overview Dashboard**:
   - Hero banner, filter tabs, project grid cards, and "Create Research Project" modal connected to `GET/POST /api/projects`.
2. `GET /projects/[id]` — **Project Workspace**:
   - **Tab 1 (Overview)**: AI Agent Health Score Index (`@sciagent/agents` Orchestration result).
   - **Tab 2 (Research Logs)**: Log entry feed & evidence submission connected to `GET/POST /api/projects/[id]/logs`.
   - **Tab 3 (Treasury & Expenses)**: On-chain grant balance & expense approval ledger connected to `GET/POST /api/projects/[id]/expenses`.
   - **Tab 4 (Milestones)**: Milestone proof URL review & fund release triggers connected to `GET/POST /api/projects/[id]/milestones`.
   - **Tab 5 (Reports & Export)**: CSV & JSON data download links connected to `GET /api/projects/[id]/export`.
