# SciAgent Protocol — Known Limitations (Pre-Deployment Tracking)

> [!IMPORTANT]
> The items listed below are current pre-deployment in-memory trade-offs designed for local testing and developer velocity. They **MUST** be migrated to persistent infrastructure prior to production launch.

---

## 1. Notification Storage (`packages/shared/services/notificationService.ts`)

- **Current State**: Uses an in-memory array (`const notificationsStore: NotificationRecord[] = []`).
- **Limitation**: All user notifications are lost when the web application server restarts.
- **Production Requirement**: Migrate to a dedicated `notifications` table in PostgreSQL / Supabase with proper RLS policies.
- **Impact**: Users will lose notification history on server restart; real-time notifications will not persist.

---

## 2. AI Agent Task Queue (`packages/agents/src/queue.ts`)

- **Current State**: Uses an in-memory JavaScript `Map` class for task scheduling and processing.
- **Limitation**: Background agent tasks do not persist across process restarts, and worker execution cannot be distributed across multiple instances.
- **Production Requirement**: Connect worker queue processing to a production Redis instance via BullMQ (`bullmq` dependency is already in `@sciagent/shared`).
- **Impact**: In-progress AI agent tasks will be lost on server restart; no horizontal scaling capability for agent workers.

---

## 3. Session Token (Development Only)

- **Current State**: Frontend uses hardcoded `mock_session_token_dev` for API authentication.
- **Limitation**: This is a development convenience and not secure for production.
- **Production Requirement**: Implement real Privy JWT authentication flow with proper token management and refresh.
- **Impact**: Currently bypasses real authentication; must be replaced before any production deployment.

---

## 4. Dashboard AI Health Scores (Display Only)

- **Current State**: The AI Health Index badges on the project workspace (`apps/web/app/projects/[id]/page.tsx` — overall 88/100, tracker 92, spending 85, milestone 87) are hardcoded display values.
- **Limitation**: They do not reflect live `@sciagent/agents` orchestrator output for the project being viewed.
- **Production Requirement**: Wire the overview tab to real orchestrator results (new API endpoint running `runOrchestration` on live project data, or a cached score from `ai_agent_runs`).
- **Impact**: Dashboard health badges are illustrative only; treasury balance, logs, milestones, and expenses shown alongside them are real.

---

## Deployment Checklist

Before deploying to production, ensure all items above are addressed:

- [ ] Notifications migrated to PostgreSQL with RLS policies
- [ ] AI agent queue migrated to Redis/BullMQ
- [ ] Real Privy JWT authentication implemented
- [ ] Dashboard health scores wired to live orchestrator output
- [ ] All hardcoded development tokens removed
- [ ] End-to-end testing with real authentication flow
