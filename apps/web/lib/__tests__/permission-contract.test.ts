/**
 * Permission contract pin — collaborator CAN create milestones + edit/delete projects,
 * but CANNOT propose expenses (owner/admin-only). This is the formally locked
 * decision going forward: per-project check is primary, global admin is intentional
 * platform override (not legacy). Real route handlers + PGlite, no mocks beyond auth.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test shim deals in dynamic row shapes */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';

(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COLLAB_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OUTSIDER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OWNER_TOKEN = `test_${OWNER_ID}`;
const COLLAB_TOKEN = `test_${COLLAB_ID}`;
const OUTSIDER_TOKEN = `test_${OUTSIDER_ID}`;

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
    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ): Promise<unknown> {
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
        const res = await this.pg.query(sql, values);
        if (this.wantSingle) return { data: res.rows[0] ?? null, error: null };
        return { data: res.rows, error: null };
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
      const pg = (globalThis as any).__TEST_PG_PERM__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
    getSupabaseAdminClient: () => {
      const pg = (globalThis as any).__TEST_PG_PERM__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
  };
});

import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../packages/database/src/seed';
import { POST as createProject } from '../../app/api/projects/route';
import { PATCH as updateProject, DELETE as deleteProject } from '../../app/api/projects/[id]/route';
import { POST as createMilestone } from '../../app/api/projects/[id]/milestones/route';
import { POST as proposeExpense } from '../../app/api/projects/[id]/expenses/route';

let pg: PGlite;

function req(url: string, method: string, body: unknown, token: string): NextRequest {
  return new Request(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  pg = new PGlite();
  await applyMigrations(pg);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`, [OWNER_ID, 'Owner']);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`, [COLLAB_ID, 'Collab']);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`, [OUTSIDER_ID, 'Outsider']);
  (globalThis as any).__TEST_PG_PERM__ = pg;
}, 60_000);

afterAll(async () => {
  await pg?.close();
  delete (globalThis as any).__TEST_PG_PERM__;
});

describe('permission contract — collaborator CAN edit project/milestone, CANNOT spend', () => {
  async function makeDraftProject(): Promise<string> {
    const res = await createProject(
      req('http://localhost/api/projects', 'POST', { name: `Perm ${Date.now()}`, metadataUri: 'https://example.com/m.json', status: 'draft' }, OWNER_TOKEN)
    );
    expect(res.status).toBe(201);
    const pid = (await res.json()).project.id as string;
    // add collab as project_collaborators row directly (invite flow already tested elsewhere)
    await pg.query(`INSERT INTO "project_collaborators" ("project_id", "user_id", "role") VALUES ($1, $2, 'collaborator') ON CONFLICT DO NOTHING`, [pid, COLLAB_ID]);
    return pid;
  }

  it('collaborator CAN create a milestone (200/201)', async () => {
    const pid = await makeDraftProject();
    const res = await createMilestone(
      req(`http://localhost/api/projects/${pid}/milestones`, 'POST', { title: 'M1', descriptionUri: 'https://example.com/d.json' }, COLLAB_TOKEN),
      { params: Promise.resolve({ id: pid }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.milestone).toBeDefined();
    expect(body.milestone.title).toBe('M1');
  });

  it('collaborator CAN edit a project (PATCH)', async () => {
    const pid = await makeDraftProject();
    const res = await updateProject(
      req(`http://localhost/api/projects/${pid}`, 'PATCH', { name: 'Edited by collab' }, COLLAB_TOKEN),
      { params: Promise.resolve({ id: pid }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.name).toBe('Edited by collab');
  });

  it('collaborator CAN delete a draft project (DELETE)', async () => {
    const pid = await makeDraftProject();
    const res = await deleteProject(
      req(`http://localhost/api/projects/${pid}`, 'DELETE', undefined, COLLAB_TOKEN),
      { params: Promise.resolve({ id: pid }) }
    );
    expect(res.status).toBe(200);
  });

  it('collaborator CANNOT propose an expense (403)', async () => {
    const pid = await makeDraftProject();
    // need treasury balance to avoid INSUFFICIENT_FUNDS masking permission
    await pg.query(`INSERT INTO "treasury_balances" ("project_id", "onchain_balance_wei") VALUES ($1, '1000000000000000000') ON CONFLICT ("project_id") DO UPDATE SET onchain_balance_wei = '1000000000000000000'`, [pid]);
    const res = await proposeExpense(
      req(`http://localhost/api/projects/${pid}/expenses`, 'POST', { recipientAddress: '0x0000000000000000000000000000000000000000', amountWei: '100', memo: 'test' }, COLLAB_TOKEN),
      { params: Promise.resolve({ id: pid }) }
    );
    expect(res.status).toBe(403);
  });

  it('outsider CANNOT create milestone (403)', async () => {
    const pid = await makeDraftProject();
    const res = await createMilestone(
      req(`http://localhost/api/projects/${pid}/milestones`, 'POST', { title: 'M2', descriptionUri: 'https://example.com/d2.json' }, OUTSIDER_TOKEN),
      { params: Promise.resolve({ id: pid }) }
    );
    expect(res.status).toBe(403);
  });
});
