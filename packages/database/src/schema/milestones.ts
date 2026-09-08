import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { milestoneStateEnum } from './enums';
import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Milestones mirror `MilestoneRegistry` states 1:1
 * (created → submitted → approved). Soft-delete via `deleted_at`.
 */
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    onchainMilestoneId: bigint('onchain_milestone_id', { mode: 'number' }).unique(),
    title: text('title').notNull(),
    descriptionUri: text('description_uri').notNull(),
    proofUri: text('proof_uri'),
    state: milestoneStateEnum('state').notNull().default('created'),
    creatorUserId: uuid('creator_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('milestones_project_id_idx').on(t.projectId),
    index('milestones_state_idx').on(t.state),
  ]
);
