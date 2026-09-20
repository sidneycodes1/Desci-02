# SciAgent Protocol — Notifications Subsystem

## Overview

The notification subsystem generates and dispatches system events for project updates, research log posts, milestone submission reviews, and treasury grant expense payouts while respecting user preference opt-in/opt-out settings.

---

## Notification Types & Event Triggers

| Event Type | Trigger Helper | Recipient | Category Preference |
|---|---|---|---|
| `research_log_submitted` | `notifyResearchLogCreated` | Project Owner | `researchLogAlerts` |
| `milestone_submitted` | `notifyMilestoneSubmitted` | Project Owner | `milestoneAlerts` |
| `milestone_approved` | `notifyMilestoneApproved` | Milestone Creator | `milestoneAlerts` |
| `milestone_rejected` | `notifyMilestoneRejected` | Milestone Creator | `milestoneAlerts` |
| `expense_approved` | `notifyExpenseApproved` | Proposer | `treasuryAlerts` |

---

## Preferences & Delivery API

- `GET /api/notifications` — Fetch user notifications feed.
- `GET /api/user/notifications/preferences` — Fetch notification preferences.
- `PUT /api/user/notifications/preferences` — Update notification preferences (`inAppAlerts`, `emailAlerts`, `milestoneAlerts`, `treasuryAlerts`, `researchLogAlerts`).
