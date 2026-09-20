/**
 * Engagement (likes/comments) — handler-level PGlite tests.
 * Proves RLS + app-layer visibility + toggle idempotency, no new auth logic.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test shim deals in dynamic row shapes */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';

(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const READER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OWNER_TOKEN = `test_${OWNER_ID}`;
const READER_TOKEN = `test_${READER_ID}`;

vi.mock('@sciagent/auth/session', () => ({
  verifySession: async (token: string) => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let userId = OWNER_ID;
    if (token.startsWith('test_')) {
      const maybe = token.slice('test_'.length);
      if (uuidRe.test(maybe)) userId = maybe;
    }
    return {
      userId,
      sessionId: 'test-session-id',
      appId: 'test-app-id',
      issuer: 'test-issuer',
      issuedAt: Date.now(),
      expiration: Date.now() + 3600_000,
      role: 'owner',
      permissions: ['project:create'],
      linkedAccounts: [],
      customMetadata: { sciagent_role: 'owner' },
    };
  },
  getAppIdentity: async (token: string) => {
    if (!token) throw new Error('Missing token');
    if (token === 'invalid-token') throw new Error('Invalid token');
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let userId = OWNER_ID;
    if (token.startsWith('test_')) {
      const maybe = token.slice('test_'.length);
      if (uuidRe.test(maybe)) userId = maybe;
    }
    return {
      userId,
      sessionId: 'test-session-id',
      appId: 'test-app-id',
      role: 'owner',
      permissions: ['project:create'],
      walletAddress: null,
      linkedAccounts: [],
    };
  },
}));

vi.mock('@sciagent/shared/supabase/server', () => {
  function qid(col: string): string {
    const base = col.includes('.') ? col.split('.').pop()! : col;
    return `"${base.replace(/"/g, '""')}"`;
  }
  interface Filter {
    op: 'eq' | 'is';
    col: string;
    val: unknown;
  }
  class Builder {
    private pg: any;
    private table: string;
    private filters: Filter[] = [];
    private orders: Array<{ col: string; asc: boolean }> = [];
    private selectCols: string | null = null;
    private insertRows: Array<Record<string, unknown>> | null = null;
    private updatePatch: Record<string, unknown> | null = null;
    private deleteMode = false;
    private wantSingle = false;
    private wantMaybeSingle = false;
    constructor(pg: any, table: string) {
      this.pg = pg;
      this.table = table;
    }
    select(cols = '*'): this {
      this.selectCols = cols ?? '*';
      return this;
    }
    eq(col: string, val: unknown): this {
      this.filters.push({ op: 'eq', col, val });
      return this;
    }
    is(col: string, val: unknown): this {
      this.filters.push({ op: 'is', col, val });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }): this {
      this.orders.push({ col, asc: opts?.ascending !== false });
      return this;
    }
    insert(rows: Record<string, unknown> | Array<Record<string, unknown>>): this {
      this.insertRows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(patch: Record<string, unknown>): this {
      this.updatePatch = patch;
      return this;
    }
    delete(): this {
      this.deleteMode = true;
      return this;
    }
    single(): this {
      this.wantSingle = true;
      return this;
    }
    maybeSingle(): this {
      this.wantMaybeSingle = true;
      return this;
    }
    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
      return this.exec().then(onfulfilled, onrejected);
    }
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<unknown> {
      return this.exec().catch(onrejected);
    }
    finally(onfinally?: (() => void) | null): Promise<unknown> {
      return this.exec().finally(onfinally);
    }
    private async exec(): Promise<{ data: any; error: any }> {
      if (
        this.table === 'project_collaborators' &&
        typeof this.selectCols === 'string' &&
        this.selectCols.includes('projects(')
      ) {
        return { data: [], error: null };
      }
      if (this.insertRows) {
        const row: Record<string, unknown> = { ...(this.insertRows[0] ?? {}) };
        if (!row.id && this.table !== 'treasury_balances' && this.table !== 'project_collaborators') {
          row.id = crypto.randomUUID();
        }
        const cols = Object.keys(row);
        const values = cols.map((c) => row[c] ?? null);
        const sql =
          `INSERT INTO "${this.table}" (${cols.map((c) => qid(c)).join(', ')}) ` +
          `VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
        try {
          const res = await this.pg.query(sql, values);
          if (this.wantSingle) return { data: res.rows[0] ?? null, error: null };
          return { data: res.rows, error: null };
        } catch (e: any) {
          // Pass through Postgres error code for unique violation handling
          return { data: null, error: { message: e.message, code: e.code ?? '23505' } };
        }
      }
      if (this.updatePatch) {
        const cols = Object.keys(this.updatePatch);
        const params: unknown[] = cols.map((c) => (this.updatePatch as any)[c] ?? null);
        const sets = cols.map((c, i) => `${qid(c)} = $${i + 1}`);
        const wheres: string[] = [];
        for (const f of this.filters) {
          if (f.col.includes('.')) continue;
          if (f.op === 'eq') {
            params.push(f.val);
            wheres.push(`${qid(f.col)} = $${params.length}`);
          } else if (f.val === null) {
            wheres.push(`${qid(f.col)} IS NULL`);
          }
        }
        let sql = `UPDATE "${this.table}" SET ${sets.join(', ')}`;
        if (wheres.length > 0) sql += ` WHERE ${wheres.join(' AND ')}`;
        sql += ' RETURNING *';
        const res = await this.pg.query(sql, params);
        if (this.wantSingle) {
          if (res.rows.length === 0) return { data: null, error: { code: 'PGRST116' } };
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }
      if (this.deleteMode) {
        const params: unknown[] = [];
        const wheres: string[] = [];
        for (const f of this.filters) {
          if (f.col.includes('.')) continue;
          if (f.op === 'eq') {
            params.push(f.val);
            wheres.push(`${qid(f.col)} = $${params.length}`);
          } else if (f.val === null) {
            wheres.push(`${qid(f.col)} IS NULL`);
          }
        }
        let sql = `DELETE FROM "${this.table}"`;
        if (wheres.length > 0) sql += ` WHERE ${wheres.join(' AND ')}`;
        sql += ' RETURNING *';
        const res = await this.pg.query(sql, params);
        return { data: res.rows, error: null };
      }
      let sql = `SELECT * FROM "${this.table}"`;
      const params: unknown[] = [];
      const wheres: string[] = [];
      for (const f of this.filters) {
        if (f.col.includes('.')) continue;
        if (f.op === 'eq') {
          params.push(f.val);
          wheres.push(`${qid(f.col)} = $${params.length}`);
        } else if (f.val === null) {
          wheres.push(`${qid(f.col)} IS NULL`);
        } else {
          params.push(f.val);
          wheres.push(`${qid(f.col)} IS NOT DISTINCT FROM $${params.length}`);
        }
      }
      if (wheres.length > 0) sql += ` WHERE ${wheres.join(' AND ')}`;
      const cleanOrders = this.orders.filter((o) => !o.col.includes('.'));
      if (cleanOrders.length > 0) {
        sql += ` ORDER BY ${cleanOrders.map((o) => `${qid(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ')}`;
      }
      const res = await this.pg.query(sql, params);
      if (this.wantMaybeSingle) return { data: res.rows[0] ?? null, error: null };
      if (this.wantSingle) {
        if (res.rows.length === 0) return { data: null, error: { code: 'PGRST116' } };
        return { data: res.rows[0], error: null };
      }
      return { data: res.rows, error: null };
    }
  }
  return {
    createSupabaseClientFromToken: (_token: string) => {
      const pg = (globalThis as any).__TEST_PG_ENGAGE__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
    getSupabaseAdminClient: () => {
      const pg = (globalThis as any).__TEST_PG_ENGAGE__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
  };
});

import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../packages/database/src/seed';
import { POST as createProject } from '../../app/api/projects/route';
import { POST as toggleLike, GET as getLikes } from '../../app/api/likes/route';
import { POST as createComment, GET as listComments } from '../../app/api/comments/route';
import { DELETE as deleteComment } from '../../app/api/comments/[id]/route';

let pg: PGlite;

function req(url: string, method: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}
function get(url: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request(url, { method: 'GET', headers }) as unknown as NextRequest;
}

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations(pg);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1,$2,'researcher') ON CONFLICT ("id") DO NOTHING`, [OWNER_ID, 'Owner']);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1,$2,'researcher') ON CONFLICT ("id") DO NOTHING`, [READER_ID, 'Reader']);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1,$2,'researcher') ON CONFLICT ("id") DO NOTHING`, [OUTSIDER_ID, 'Outsider']);
  (globalThis as any).__TEST_PG_ENGAGE__ = pg;
}, 60_000);

afterAll(async () => {
  await pg?.close();
  delete (globalThis as any).__TEST_PG_ENGAGE__;
});

async function makePublicProject(): Promise<string> {
  const res = await createProject(
    req('http://localhost/api/projects', 'POST', { name: `Pub ${Date.now()}`, metadataUri: 'https://example.com/m.json', status: 'active' }, OWNER_TOKEN)
  );
  expect(res.status).toBe(201);
  return (await res.json()).project.id as string;
}

describe('engagement — likes/comments', () => {
  it('signed-in user CAN like a project they do not own', async () => {
    const pid = await makePublicProject();
    const res = await toggleLike(req('http://localhost/api/likes', 'POST', { targetType: 'project', targetId: pid }, READER_TOKEN));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.liked).toBe(true);
    expect(body.count).toBe(1);

    const getRes = await getLikes(get(`http://localhost/api/likes?targetType=project&targetId=${pid}`, READER_TOKEN));
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.count).toBe(1);
    expect(getBody.liked).toBe(true);
  });

  it('signed-in user CAN comment on a project they do not own', async () => {
    const pid = await makePublicProject();
    const res = await createComment(
      req('http://localhost/api/comments', 'POST', { targetType: 'project', targetId: pid, body: 'Great work!' }, READER_TOKEN)
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.comment.body).toBe('Great work!');

    const list = await listComments(get(`http://localhost/api/comments?targetType=project&targetId=${pid}`, READER_TOKEN));
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(listed.comments.some((c: any) => c.body === 'Great work!')).toBe(true);
  });

  it('user CANNOT delete another user comment (403)', async () => {
    const pid = await makePublicProject();
    const created = await createComment(
      req('http://localhost/api/comments', 'POST', { targetType: 'project', targetId: pid, body: 'Delete me not' }, READER_TOKEN)
    );
    expect(created.status).toBe(201);
    const cid = (await created.json()).comment.id as string;

    // Owner tries to delete reader's comment -> 403
    const delByOwner = await deleteComment(req(`http://localhost/api/comments/${cid}`, 'DELETE', undefined, OWNER_TOKEN), {
      params: Promise.resolve({ id: cid }),
    } as any);
    expect(delByOwner.status).toBe(403);

    // Reader deletes own -> 200, and list excludes it
    const delByAuthor = await deleteComment(req(`http://localhost/api/comments/${cid}`, 'DELETE', undefined, READER_TOKEN), {
      params: Promise.resolve({ id: cid }),
    } as any);
    expect(delByAuthor.status).toBe(200);

    const list = await listComments(get(`http://localhost/api/comments?targetType=project&targetId=${pid}`, READER_TOKEN));
    const listed = await list.json();
    expect(listed.comments.some((c: any) => c.id === cid)).toBe(false);
  });

  it('logged-out request is rejected (401) for like and comment', async () => {
    const pid = await makePublicProject();
    const likeNoAuth = await toggleLike(req('http://localhost/api/likes', 'POST', { targetType: 'project', targetId: pid }));
    expect(likeNoAuth.status).toBe(401);

    const commentNoAuth = await createComment(req('http://localhost/api/comments', 'POST', { targetType: 'project', targetId: pid, body: 'nope' }));
    expect(commentNoAuth.status).toBe(401);

    const listNoAuth = await listComments(get(`http://localhost/api/comments?targetType=project&targetId=${pid}`));
    expect(listNoAuth.status).toBe(401);
  });

  it('liking twice toggles back to zero, no duplicate row', async () => {
    const pid = await makePublicProject();

    const first = await toggleLike(req('http://localhost/api/likes', 'POST', { targetType: 'project', targetId: pid }, READER_TOKEN));
    expect(first.status).toBe(201);
    expect((await first.json()).count).toBe(1);

    // Second toggle -> unlike
    const second = await toggleLike(req('http://localhost/api/likes', 'POST', { targetType: 'project', targetId: pid }, READER_TOKEN));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.liked).toBe(false);
    expect(secondBody.count).toBe(0);

    // Verify DB has zero rows for this target+user
    const rows = await pg.query(`SELECT * FROM "likes" WHERE "target_id"=$1 AND "user_id"=$2`, [pid, READER_ID]);
    expect(rows.rows.length).toBe(0);

    // Third -> like again
    const third = await toggleLike(req('http://localhost/api/likes', 'POST', { targetType: 'project', targetId: pid }, READER_TOKEN));
    expect(third.status).toBe(201);
    expect((await third.json()).count).toBe(1);
  });
});
