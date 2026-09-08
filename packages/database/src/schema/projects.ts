import { bigint, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { projectStatusEnum } from './enums';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Research projects. `onchain_project_id` is NULL until minted on-chain.
 * Soft-delete via `deleted_at` (history must survive for treasury audit).
 * State machine (draft → active → completed/archived) enforced in Phase 5
 * app layer; column + check constraint exist here.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    onchainProjectId: bigint('onchain_project_id', { mode: 'number' }).unique(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    metadataUri: text('metadata_uri').notNull(),
    status: projectStatusEnum('status').notNull().default('draft'),
    onchainTxHash: text('onchain_tx_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('projects_owner_user_id_idx').on(t.ownerUserId),
    index('projects_status_idx').on(t.status),
  ]
);

export const projectCollaborators = pgTable(
  'project_collaborators',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('collaborator'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index('project_collaborators_user_id_idx').on(t.userId),
  ]
);
