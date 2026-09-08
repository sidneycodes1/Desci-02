import { eq } from 'drizzle-orm';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import * as schema from '../src/schema/index.js';
import { SEED_IDS, SEED_WALLETS } from '../src/seed-data.js';
import { asUser, createSeededDb, type TestContext } from './setup.js';

let ctx: TestContext;
const { alice, bob, carol } = SEED_IDS;

/** Drizzle wraps driver errors ("Failed query: ...") — assert on the cause. */
async function expectBlocked(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const err = error as { message?: string; cause?: { code?: string; message?: string } };
    const hay = `${err.message ?? ''} ${err.cause?.code ?? ''} ${err.cause?.message ?? ''}`;
    expect(hay).toMatch(/42501|row-level security|permission denied/i);
    return;
  }
  expect.unreachable('expected query to be blocked by RLS/grants');
}

beforeAll(async () => {
  ctx = await createSeededDb();
});

afterAll(async () => {
  await ctx.close();
});

describe('RLS: project visibility', () => {
  it('outsider (carol) sees active project but NOT the draft', async () => {
    const rows = await asUser(ctx, carol, (db) => db.select().from(schema.projects));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(SEED_IDS.projectOpenScience);
    expect(ids).not.toContain(SEED_IDS.projectDraft);
  });

  it('collaborator (bob) sees member project but not unrelated draft', async () => {
    const rows = await asUser(ctx, bob, (db) => db.select().from(schema.projects));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(SEED_IDS.projectOpenScience);
    expect(ids).not.toContain(SEED_IDS.projectDraft);
  });

  it('owner (alice) sees both projects', async () => {
    const rows = await asUser(ctx, alice, (db) => db.select().from(schema.projects));
    expect(rows.map((r) => r.id).sort()).toEqual(
      [SEED_IDS.projectDraft, SEED_IDS.projectOpenScience].sort()
    );
  });

  it('outsider cannot see draft milestone', async () => {
    const rows = await asUser(ctx, carol, (db) =>
      db.select().from(schema.milestones).where(eq(schema.milestones.id, SEED_IDS.milestoneDraft))
    );
    expect(rows.length).toBe(0);
  });
});

describe('RLS: writes require ownership', () => {
  it('outsider cannot propose an expense (blocked)', async () => {
    await expectBlocked(
      asUser(ctx, carol, (db) =>
        db.insert(schema.expenses).values({
          projectId: SEED_IDS.projectOpenScience,
          proposerUserId: carol,
          recipientAddress: SEED_WALLETS.alice,
          amountWei: '100',
          memo: 'carol tries',
          status: 'proposed',
        })
      )
    );
  });

  it('collaborator cannot propose an expense (owner-only)', async () => {
    await expectBlocked(
      asUser(ctx, bob, (db) =>
        db.insert(schema.expenses).values({
          projectId: SEED_IDS.projectOpenScience,
          proposerUserId: bob,
          recipientAddress: SEED_WALLETS.alice,
          amountWei: '100',
          memo: 'bob tries',
          status: 'proposed',
        })
      )
    );
  });

  it('collaborator UPDATE on project silently affects 0 rows', async () => {
    const updated = await asUser(ctx, bob, (db) =>
      db
        .update(schema.projects)
        .set({ name: 'Hijacked' })
        .where(eq(schema.projects.id, SEED_IDS.projectOpenScience))
        .returning()
    );
    expect(updated.length).toBe(0);
    // owner view unchanged (bypass RLS as owner connection)
    const current = (
      await ctx.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, SEED_IDS.projectOpenScience))
    )[0];
    expect(current?.name).toBe('Open Science');
  });

  it('owner can propose an expense', async () => {
    const created = await asUser(ctx, alice, (db) =>
      db
        .insert(schema.expenses)
        .values({
          projectId: SEED_IDS.projectOpenScience,
          proposerUserId: alice,
          recipientAddress: SEED_WALLETS.alice,
          amountWei: '100',
          memo: 'owner top-up',
          status: 'proposed',
        })
        .returning()
    );
    expect(created.length).toBe(1);
    // cleanup as owner (bypasses RLS, like service_role would)
    await ctx.db.delete(schema.expenses).where(eq(schema.expenses.id, created[0]!.id));
  });
});

describe('RLS: users table', () => {
  it('outsider cannot read unrelated user row', async () => {
    const rows = await asUser(ctx, carol, (db) =>
      db.select().from(schema.users).where(eq(schema.users.id, alice))
    );
    expect(rows.length).toBe(0);
  });

  it('collaborator can read project owner row (shared project)', async () => {
    const rows = await asUser(ctx, bob, (db) =>
      db.select().from(schema.users).where(eq(schema.users.id, alice))
    );
    expect(rows.length).toBe(1);
  });

  it('owner can update display_name but cannot escalate role', async () => {
    const updated = await asUser(ctx, alice, (db) =>
      db
        .update(schema.users)
        .set({ displayName: 'Alice Updated' })
        .where(eq(schema.users.id, alice))
        .returning()
    );
    expect(updated[0]?.displayName).toBe('Alice Updated');

    await expectBlocked(
      asUser(ctx, alice, (db) =>
        db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, alice))
      )
    );
  });

  it('wallets are owner-only (outsider sees none of alice)', async () => {
    const rows = await asUser(ctx, carol, (db) =>
      db.select().from(schema.wallets).where(eq(schema.wallets.userId, alice))
    );
    expect(rows.length).toBe(0);
    const own = await asUser(ctx, alice, (db) =>
      db.select().from(schema.wallets).where(eq(schema.wallets.userId, alice))
    );
    expect(own.length).toBe(1);
  });
});

describe('RLS: oracle / admin-only writes', () => {
  it('outsider cannot insert reputation events', async () => {
    await expectBlocked(
      asUser(ctx, carol, (db) =>
        db.insert(schema.reputationEvents).values({
          subjectUserId: carol,
          subjectAddress: '0xcarol',
          projectId: SEED_IDS.projectOpenScience,
          points: 5,
          reason: 'self-deal',
          actorUserId: carol,
        })
      )
    );
  });

  it('owner (oracle delegate) can insert reputation events', async () => {
    const created = await asUser(ctx, alice, (db) =>
      db
        .insert(schema.reputationEvents)
        .values({
          subjectUserId: bob,
          subjectAddress: SEED_WALLETS.bob,
          projectId: SEED_IDS.projectOpenScience,
          points: 3,
          reason: 'helpful review',
          actorUserId: alice,
        })
        .returning()
    );
    expect(created.length).toBe(1);
    await ctx.db
      .delete(schema.reputationEvents)
      .where(eq(schema.reputationEvents.id, created[0]!.id));
  });

  it('authenticated users cannot write agent runs (admin-only)', async () => {
    await expectBlocked(
      asUser(ctx, alice, (db) =>
        db.insert(schema.aiAgentRuns).values({
          agentName: 'tracker',
          triggerEventType: 'manual',
          projectId: SEED_IDS.projectOpenScience,
          input: {},
          model: 'x',
          modelVersion: 'x',
          status: 'queued',
        })
      )
    );
  });

  it('member can read agent runs, outsider sees none', async () => {
    const memberRows = await asUser(ctx, bob, (db) => db.select().from(schema.aiAgentRuns));
    expect(memberRows.length).toBe(1);
    const outsiderRows = await asUser(ctx, carol, (db) => db.select().from(schema.aiAgentRuns));
    expect(outsiderRows.length).toBe(0);
  });

  it('authenticated users cannot write treasury balances (reconciliation-only)', async () => {
    // Remove the seeded draft balance as owner so the insert below tests
    // grants/RLS (not a PK conflict), then restore it afterwards.
    await ctx.db
      .delete(schema.treasuryBalances)
      .where(eq(schema.treasuryBalances.projectId, SEED_IDS.projectDraft));
    try {
      // No INSERT grant/policy: insert throws.
      await expectBlocked(
        asUser(ctx, alice, (db) =>
          db.insert(schema.treasuryBalances).values({
            projectId: SEED_IDS.projectDraft,
            onchainBalanceWei: '1',
          })
        )
      );
    } finally {
      await ctx.db.insert(schema.treasuryBalances).values({
        projectId: SEED_IDS.projectDraft,
        onchainBalanceWei: '0',
      });
    }
    // No UPDATE grant either: permission denied (42501), not silent 0 rows.
    await expectBlocked(
      asUser(ctx, alice, (db) =>
        db
          .update(schema.treasuryBalances)
          .set({ onchainBalanceWei: '1' })
          .where(eq(schema.treasuryBalances.projectId, SEED_IDS.projectOpenScience))
          .returning()
      )
    );
  });
});
