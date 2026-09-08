import { bigint, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Reputation events mirror `ReputationRegistry` (points != 0 enforced by
 * app + DB check in migration). `subject_address` is kept even when no
 * user row exists. Audit trail: never delete.
 */
export const reputationEvents = pgTable(
  'reputation_events',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    subjectUserId: uuid('subject_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    subjectAddress: text('subject_address').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    points: integer('points').notNull(),
    reason: text('reason').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    onchainEventId: bigint('onchain_event_id', { mode: 'number' }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reputation_events_project_id_idx').on(t.projectId),
    index('reputation_events_subject_user_id_idx').on(t.subjectUserId),
  ]
);

/** Materialized score cache (sum of events per subject). No soft-delete. */
export const reputationScores = pgTable('reputation_scores', {
  subjectUserId: uuid('subject_user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
