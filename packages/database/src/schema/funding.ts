import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Phase 2 funding (plan §06) — first-class funder relationship.
 * Funding NEVER grants edit access (see membership.ts): funders read,
 * track, and approve releases; only owner/collaborators edit.
 * `totalFundedWei` accumulates across repeat funds; never deleted.
 */
export const projectFunders = pgTable(
  'project_funders',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    totalFundedWei: numeric('total_funded_wei', { precision: 78, scale: 0 })
      .notNull()
      .default('0'),
    firstFundedAt: timestamp('first_funded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastFundedAt: timestamp('last_funded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('project_funders_project_id_idx').on(t.projectId),
    index('project_funders_user_id_idx').on(t.userId),
  ]
);

/**
 * Phase 4 collaboration invites (plan §05/§06).
 * Pending rows live here; on accept a `project_collaborators` row is
 * created (existing table reused — no backfill risk). Shareable links
 * use `token` with NULL `inviteeId` (any authenticated wallet may claim).
 */
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    entityType: text('entity_type').notNull().default('project'),
    entityId: uuid('entity_id').notNull(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
    inviteeHandle: text('invitee_handle'),
    role: text('role').notNull().default('collaborator'),
    token: text('token').unique(),
    status: text('status').notNull().default('pending'),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('invites_entity_idx').on(t.entityType, t.entityId),
    index('invites_invitee_idx').on(t.inviteeId),
    index('invites_token_idx').on(t.token),
    index('invites_status_idx').on(t.status),
  ]
);
