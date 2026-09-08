import {
  bigint,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { expenseStatusEnum } from './enums';
import { projects } from './projects';
import { users } from './users';

const uuidDefault = () => crypto.randomUUID();

/**
 * Cached on-chain balance per project (one row per project).
 * Source of truth is the chain; Phase 7 reconciles. No soft-delete.
 */
export const treasuryBalances = pgTable('treasury_balances', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  onchainBalanceWei: numeric('onchain_balance_wei', { precision: 78, scale: 0 })
    .notNull()
    .default('0'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSyncedBlock: bigint('last_synced_block', { mode: 'number' }),
});

/**
 * Spend requests mirror `GrantTreasury` expenses.
 * `memo` is varchar(1024) to match `MAX_MEMO_LENGTH` on-chain.
 * `recipient_address` must equal the project owner (contract rule) —
 * cross-table so enforced in app layer + documented, not a DB CHECK.
 * Financial audit trail: NEVER delete rows.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().$defaultFn(uuidDefault),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    onchainExpenseId: bigint('onchain_expense_id', { mode: 'number' }).unique(),
    proposerUserId: uuid('proposer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    recipientAddress: text('recipient_address').notNull(),
    amountWei: numeric('amount_wei', { precision: 78, scale: 0 }).notNull(),
    memo: varchar('memo', { length: 1024 }).notNull(),
    status: expenseStatusEnum('status').notNull().default('proposed'),
    proposeTxHash: text('propose_tx_hash'),
    approveTxHash: text('approve_tx_hash'),
    executeTxHash: text('execute_tx_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('expenses_project_id_idx').on(t.projectId),
    index('expenses_status_idx').on(t.status),
  ]
);
