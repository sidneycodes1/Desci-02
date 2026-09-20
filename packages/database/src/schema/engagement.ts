import { index, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Likes — polymorphic target (project|article), hard-delete on unlike.
 * One row per (user, target) enforced by unique constraint; duplicate
 * POST is handled by ON CONFLICT / unique-violation catch, not 500.
 */
export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('likes_user_target_unique').on(t.userId, t.targetType, t.targetId),
    index('likes_target_idx').on(t.targetType, t.targetId),
    index('likes_user_idx').on(t.userId),
  ]
);

/**
 * Comments — polymorphic target, soft-delete via deletedAt (matches
 * research_logs:36 and articles:31 pattern). Body length validated in Zod
 * (1..2000 chars, same as researchLogs title/content), DB has no length cap
 * beyond text.
 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('comments_target_idx').on(t.targetType, t.targetId),
    index('comments_author_idx').on(t.authorUserId),
    index('comments_created_at_idx').on(t.createdAt),
  ]
);
