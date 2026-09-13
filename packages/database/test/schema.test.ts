import { sql } from 'drizzle-orm';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import * as schema from '../src/schema/index.js';
import { SEED_IDS } from '../src/seed-data.js';
import { createSeededDb, type TestContext } from './setup.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createSeededDb();
});

afterAll(async () => {
  await ctx.close();
});

async function tableExists(table: string): Promise<boolean> {
  const rows = await ctx.db.execute(
    sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${table}`
  );
  return rows.rows.length === 1;
}

describe('schema: tables exist', () => {
  const tables = [
    'users',
    'wallets',
    'projects',
    'project_collaborators',
    'milestones',
    'treasury_balances',
    'expenses',
    'reputation_events',
    'reputation_scores',
    'ai_agent_runs',
    'research_logs',
  ];
  for (const table of tables) {
    it(`has table ${table}`, async () => {
      expect(await tableExists(table)).toBe(true);
    });
  }
});

describe('schema: RLS enabled everywhere', () => {
  it('all 11 tables have rowsecurity on', async () => {
    const rows = await ctx.db.execute(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = true`);
    const names = rows.rows.map((r) => (r as unknown as { tablename: string }).tablename).sort();
    expect(names).toEqual(
      [
        'ai_agent_runs',
        'expenses',
        'milestones',
        'project_collaborators',
        'projects',
        'reputation_events',
        'reputation_scores',
        'treasury_balances',
        'research_logs',
        'users',
        'wallets',
      ].sort()
    );
  });

  it('every table has at least one policy', async () => {
    const rows = await ctx.db.execute(sql`
      SELECT tablename, COUNT(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' GROUP BY tablename`);
    const byTable = new Map(
      rows.rows.map((r) => {
        const row = r as unknown as { tablename: string; n: number };
        return [row.tablename, row.n];
      })
    );
    for (const t of [
      'users',
      'wallets',
      'projects',
      'project_collaborators',
      'milestones',
      'treasury_balances',
      'expenses',
      'reputation_events',
      'reputation_scores',
      'ai_agent_runs',
      'research_logs',
    ]) {
      expect(byTable.get(t) ?? 0, `policies on ${t}`).toBeGreaterThan(0);
    }
  });
});

describe('schema: DB-level constraints', () => {
  it('rejects memo longer than 1024 (mirrors MAX_MEMO_LENGTH)', async () => {
    await expect(
      ctx.db.insert(schema.expenses).values({
        projectId: SEED_IDS.projectOpenScience,
        proposerUserId: SEED_IDS.alice,
        recipientAddress: '0xA11ce0000000000000000000000000000000001',
        amountWei: '1',
        memo: 'x'.repeat(1025),
        status: 'proposed',
      })
    ).rejects.toThrow();
  });

  it('rejects zero-amount expenses', async () => {
    await expect(
      ctx.db.insert(schema.expenses).values({
        projectId: SEED_IDS.projectOpenScience,
        proposerUserId: SEED_IDS.alice,
        recipientAddress: '0xA11ce0000000000000000000000000000000001',
        amountWei: '0',
        memo: 'zero',
        status: 'proposed',
      })
    ).rejects.toThrow();
  });

  it('rejects zero-point reputation events', async () => {
    await expect(
      ctx.db.insert(schema.reputationEvents).values({
        subjectUserId: SEED_IDS.alice,
        subjectAddress: '0xA11ce0000000000000000000000000000000001',
        projectId: SEED_IDS.projectOpenScience,
        points: 0,
        reason: 'nothing',
        actorUserId: SEED_IDS.alice,
      })
    ).rejects.toThrow();
  });

  it('rejects duplicate wallet addresses', async () => {
    await expect(
      ctx.db.insert(schema.wallets).values({
        userId: SEED_IDS.bob,
        address: '0xA11ce0000000000000000000000000000000001',
        chainId: 84532,
        isPrimary: false,
      })
    ).rejects.toThrow();
  });

  it('rejects expenses for missing projects (FK)', async () => {
    await expect(
      ctx.db.insert(schema.expenses).values({
        projectId: '00000000-0000-4000-8000-000000000099',
        proposerUserId: SEED_IDS.alice,
        recipientAddress: '0xA11ce0000000000000000000000000000000001',
        amountWei: '1',
        memo: 'ghost',
        status: 'proposed',
      })
    ).rejects.toThrow();
  });
});

describe('schema: seed relations', () => {
  it('seeded project links owner, milestone, expense, balance', async () => {
    const project = (
      await ctx.db
        .select()
        .from(schema.projects)
        .where(sql`${schema.projects.id} = ${SEED_IDS.projectOpenScience}`)
    )[0];
    expect(project?.ownerUserId).toBe(SEED_IDS.alice);
    expect(project?.status).toBe('active');

    const milestones = await ctx.db
      .select()
      .from(schema.milestones)
      .where(sql`${schema.milestones.projectId} = ${SEED_IDS.projectOpenScience}`);
    expect(milestones.length).toBe(1);
    expect(milestones[0]?.state).toBe('submitted');
  });
});
