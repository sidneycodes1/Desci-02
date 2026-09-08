import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { userRoleEnum } from './enums';

const uuidDefault = () => crypto.randomUUID();

/**
 * App profile keyed 1:1 to Supabase `auth.users.id`.
 * No FK to `auth.users` (Supabase-managed schema) — enforced in app code.
 * No soft-delete: identity rows are never removed.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    walletAddress: text('wallet_address').unique(),
    displayName: text('display_name'),
    role: userRoleEnum('role').notNull().default('researcher'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_wallet_address_idx').on(t.walletAddress)]
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    address: text('address').notNull().unique(),
    chainId: integer('chain_id').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('wallets_user_id_idx').on(t.userId)]
);
