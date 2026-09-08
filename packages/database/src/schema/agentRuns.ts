import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { agentNameEnum, agentRunStatusEnum } from './enums';
import { projects } from './projects';

const uuidDefault = () => crypto.randomUUID();

/**
 * AI agent audit log (Phase 9 writes here via the ADMIN client only —
 * no authenticated-user inserts; see RLS migration).
 * `needs_review` is the human-in-the-loop gate. Never delete.
 */
export const aiAgentRuns = pgTable(
  'ai_agent_runs',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    agentName: agentNameEnum('agent_name').notNull(),
    triggerEventType: text('trigger_event_type').notNull(),
    triggerRefId: uuid('trigger_ref_id'),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    model: text('model').notNull(),
    modelVersion: text('model_version').notNull(),
    status: agentRunStatusEnum('status').notNull().default('queued'),
    error: text('error'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_agent_runs_agent_status_idx').on(t.agentName, t.status),
    index('ai_agent_runs_project_id_idx').on(t.projectId),
  ]
);
