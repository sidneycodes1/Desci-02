# SciAgent Protocol — Known Limitations (Pre-Deployment Tracking)

> [!IMPORTANT]
> The items listed below are current pre-deployment in-memory trade-offs designed for local testing and developer velocity. They **MUST** be migrated to persistent infrastructure prior to production launch.

---

## 1. Notification Storage (`packages/shared/services/notificationService.ts`)
- **Current State**: Uses an in-memory array (`const notificationsStore: NotificationRecord[] = []`).
- **Limitation**: All user notifications are lost when the web application server restarts.
- **Production Requirement**: Migrate to a dedicated `notifications` table in PostgreSQL / Supabase with proper RLS policies.

---

## 2. AI Agent Task Queue (`packages/agents/src/queue.ts`)
- **Current State**: Uses an in-memory JavaScript `Map` class for task scheduling and processing.
- **Limitation**: Background agent tasks do not persist across process restarts, and worker execution cannot be distributed across multiple instances.
- **Production Requirement**: Connect worker queue processing to a production Redis instance via BullMQ (`bullmq` dependency is already in `@sciagent/shared`).
