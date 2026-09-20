import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Phase 3 reader publishing (plan §06) — public posts by ANY user,
 * optionally linked to a project. Independent of project membership:
 * a reader writes here without being a collaborator anywhere.
 * Soft-delete preserves history; slug is the public URL key.
 */
export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    body: text('body').notNull(),
    status: text('status').notNull().default('draft'),
    visibility: text('visibility').notNull().default('public'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('articles_author_id_idx').on(t.authorId),
    index('articles_project_id_idx').on(t.projectId),
    index('articles_status_idx').on(t.status),
    index('articles_slug_idx').on(t.slug),
  ]
);

/** Invited editors for an article (mirrors project_collaborators). */
export const articleCollaborators = pgTable(
  'article_collaborators',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('article_collaborators_article_idx').on(t.articleId),
    index('article_collaborators_user_idx').on(t.userId),
  ]
);
