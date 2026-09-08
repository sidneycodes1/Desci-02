/**
 * Seed script: inserts realistic sample data for local testing.
 *
 * Usage:
 *   pnpm --filter @sciagent/database db:seed            # PGlite file DB at ./.local-pglite
 *   DATABASE_URL=postgres://... pnpm ... db:seed        # (Supabase/Postgres: requires `pg` driver — Phase 7)
 *
 * Local seeding runs against PGlite (no docker needed) and applies
 * ./migrations first, so the script is self-contained. Inserts run as
 * table owner (mirrors service_role seeding on Supabase, bypassing RLS
 * exactly as the admin client would).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

import * as schema from './schema/index.js';
import { SEED_IDS, SEED_WALLETS } from './seed-data.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

export type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

export function migrationStatements(): string[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')
  ) as { entries: Array<{ tag: string }> };
  const statements: string[] = [];
  for (const entry of journal.entries) {
    const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8');
    for (const part of sql.split('--> statement-breakpoint')) {
      const trimmed = part.trim();
      if (trimmed.length > 0) statements.push(trimmed);
    }
  }
  return statements;
}

export async function applyMigrations(pg: PGlite, { withAuthShim = true } = {}) {
  if (withAuthShim) {
    // Local stand-in for Supabase's auth.uid(). NOT part of real migrations.
    // (Postgres has no CREATE ROLE IF NOT EXISTS — use DO blocks.)
    await pg.exec(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  }
  for (const stmt of migrationStatements()) {
    await pg.exec(stmt);
  }
}

export async function seedDatabase(db: SeedDb) {
  const { admin, alice, bob, carol } = SEED_IDS;

  await db.insert(schema.users).values([
    { id: admin, walletAddress: SEED_WALLETS.admin, displayName: 'Admin', role: 'admin' },
    {
      id: alice,
      walletAddress: SEED_WALLETS.alice,
      displayName: 'Alice Researcher',
      role: 'researcher',
    },
    {
      id: bob,
      walletAddress: SEED_WALLETS.bob,
      displayName: 'Bob Collaborator',
      role: 'researcher',
    },
    { id: carol, walletAddress: null, displayName: 'Carol Outsider', role: 'reviewer' },
  ]);

  await db.insert(schema.wallets).values([
    { userId: alice, address: SEED_WALLETS.alice, chainId: 84532, isPrimary: true },
    { userId: bob, address: SEED_WALLETS.bob, chainId: 84532, isPrimary: true },
  ]);

  await db.insert(schema.projects).values([
    {
      id: SEED_IDS.projectOpenScience,
      onchainProjectId: 1,
      ownerUserId: alice,
      name: 'Open Science',
      metadataUri: 'ipfs://open-science',
      status: 'active',
    },
    {
      id: SEED_IDS.projectDraft,
      onchainProjectId: 2,
      ownerUserId: alice,
      name: 'Stealth Draft',
      metadataUri: 'ipfs://stealth-draft',
      status: 'draft',
    },
  ]);

  await db
    .insert(schema.projectCollaborators)
    .values([{ projectId: SEED_IDS.projectOpenScience, userId: bob, role: 'collaborator' }]);

  await db.insert(schema.milestones).values([
    {
      id: SEED_IDS.milestonePreprint,
      projectId: SEED_IDS.projectOpenScience,
      onchainMilestoneId: 1,
      title: 'Preprint submission',
      descriptionUri: 'ipfs://milestone-brief',
      proofUri: 'ipfs://preprint-proof',
      state: 'submitted',
      creatorUserId: alice,
    },
    {
      id: SEED_IDS.milestoneDraft,
      projectId: SEED_IDS.projectDraft,
      title: 'Secret milestone',
      descriptionUri: 'ipfs://secret',
      state: 'created',
      creatorUserId: alice,
    },
  ]);

  await db.insert(schema.treasuryBalances).values([
    { projectId: SEED_IDS.projectOpenScience, onchainBalanceWei: '8000000000000000000' },
    { projectId: SEED_IDS.projectDraft, onchainBalanceWei: '0' },
  ]);

  await db.insert(schema.expenses).values([
    {
      id: SEED_IDS.expensePublish,
      projectId: SEED_IDS.projectOpenScience,
      onchainExpenseId: 1,
      proposerUserId: alice,
      recipientAddress: SEED_WALLETS.alice,
      amountWei: '3000000000000000000',
      memo: 'publish paper',
      status: 'approved',
    },
  ]);

  await db.insert(schema.reputationEvents).values([
    {
      id: SEED_IDS.reputationEvent,
      subjectUserId: alice,
      subjectAddress: SEED_WALLETS.alice,
      projectId: SEED_IDS.projectOpenScience,
      points: 15,
      reason: 'delivered the milestone',
      actorUserId: alice,
      onchainEventId: 1,
    },
  ]);

  await db.insert(schema.reputationScores).values([{ subjectUserId: alice, score: 15 }]);

  await db.insert(schema.aiAgentRuns).values([
    {
      id: SEED_IDS.agentRun,
      agentName: 'milestone',
      triggerEventType: 'milestone.submitted',
      triggerRefId: SEED_IDS.milestonePreprint,
      projectId: SEED_IDS.projectOpenScience,
      input: { milestoneId: SEED_IDS.milestonePreprint },
      model: 'gpt-4.1-mini',
      modelVersion: 'test',
      status: 'needs_review',
    },
  ]);

  return {
    users: 4,
    wallets: 2,
    projects: 2,
    milestones: 2,
    expenses: 1,
  };
}

async function main() {
  const pg = new PGlite(join(here, '..', '.local-pglite'));
  try {
    await applyMigrations(pg);
    const db = drizzle(pg, { schema });
    const counts = await seedDatabase(db);
    console.log(JSON.stringify({ ok: true, counts }, null, 2));
  } finally {
    await pg.close();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/seed.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
