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

## Deployment Checklist

Before deploying to production, ensure all items above are addressed:

- [ ] Notifications migrated to PostgreSQL with RLS policies
- [ ] AI agent queue migrated to Redis/BullMQ
- [ ] Real Privy JWT authentication implemented
- [ ] All hardcoded development tokens removed
- [ ] End-to-end testing with real authentication flow
