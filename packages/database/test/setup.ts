import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

import * as schema from '../src/schema/index.js';
import { applyMigrations, seedDatabase } from '../src/seed.js';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestContext {
  pg: PGlite;
  db: TestDb;
  close: () => Promise<void>;
}

/** Fresh in-memory Postgres with auth shim + all migrations applied. */
export async function createTestDb(): Promise<TestContext> {
  const pg = new PGlite();
  await applyMigrations(pg);
  const db = drizzle(pg, { schema });
  return { pg, db, close: () => pg.close() };
}

/** Fresh DB + seed rows (inserted as owner = service_role equivalent). */
export async function createSeededDb(): Promise<TestContext> {
  const ctx = await createTestDb();
  await seedDatabase(ctx.db);
  return ctx;
}

function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Run `fn` as an authenticated app user: SET ROLE authenticated +
 * request.jwt.claim.sub, then RESET. Mirrors Supabase RLS enforcement —
 * queries outside this helper run as owner (bypass RLS), exactly like
 * service_role seeding.
 */
export async function asUser<T>(
  ctx: TestContext,
  userId: string,
  fn: (db: TestDb) => Promise<T>
): Promise<T> {
  const { pg, db } = ctx;
  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = ${escapeLiteral(userId)};`);
  try {
    return await fn(db);
  } finally {
    await pg.exec(`RESET request.jwt.claim.sub; RESET ROLE;`);
  }
}
