import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Research logs / progress updates tied to a project.
 * Supports evidence uploads (IPFS CID via Pinata), timestamps, and author tracking.
 */
export const researchLogs = pgTable(
  'research_logs',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    evidenceCid: text('evidence_cid'),
    evidenceMimeType: text('evidence_mime_type'),
    evidenceSizeBytes: bigint('evidence_size_bytes', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('research_logs_project_id_idx').on(t.projectId),
    index('research_logs_author_user_id_idx').on(t.authorUserId),
    index('research_logs_created_at_idx').on(t.createdAt),
  ]
);
