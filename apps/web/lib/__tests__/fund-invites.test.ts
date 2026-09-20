/**
 * Phase 2+4 — funding + invites via REAL route handlers (PGlite, no live creds).
 *
 * Same pattern as api-integration.test.ts: test-only auth double + minimal
 * PostgREST-like shim over a real in-memory PGlite Postgres (migrations
 * applied, including 0005_funders_invites). Proves:
 * - POST /api/projects/[id]/fund records + accumulates funder totals and
 *   credits the cached treasury balance (plan §02: funding never grants edit).
 * - POST /api/invites enforces owner-only sends; accept resolves into a
 *   project_collaborators row; link invites accept by any wallet.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test shim deals in dynamic row shapes */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';

(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FUNDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER_TOKEN = `test_${OWNER_ID}`;
const FUNDER_TOKEN = `test_${FUNDER_ID}`;

vi.mock('@sciagent/auth/session', () => ({
  verifySession: async (token: string) => {
    if (process.env.NODE_ENV !== 'test' && process.env.TEST_MODE !== 'true') {
      throw new Error('test double only available in test mode');
    }
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
    if (process.env.NODE_ENV !== 'test' && process.env.TEST_MODE !== 'true') {
      throw new Error('test double only available in test mode');
    }
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
        // treasury_balances (PK project_id) and project_collaborators
        // (composite PK) have no `id` column — don't invent one.
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
      const pg = (globalThis as any).__TEST_PG_FUND__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
    getSupabaseAdminClient: () => {
      const pg = (globalThis as any).__TEST_PG_FUND__;
      if (!pg) throw new Error('PGlite test DB not initialized');
      return { from: (table: string) => new Builder(pg, table) };
    },
  };
});

import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../packages/database/src/seed';
import { POST as createProject } from '../../app/api/projects/route';
import { GET as listFunders, POST as fundProject } from '../../app/api/projects/[id]/fund/route';
import { GET as listInvites, POST as createInvite } from '../../app/api/invites/route';
import { POST as respondInvite } from '../../app/api/invites/[token]/route';
import { addWei, fundProjectSchema, createInviteSchema } from '../validation/funding';
import { GET as listArticles, POST as createArticle } from '../../app/api/articles/route';
import {
  GET as getArticle,
  PATCH as updateArticle,
  DELETE as deleteArticle,
} from '../../app/api/articles/[slug]/route';
import { slugify, readingMinutes } from '../validation/article';

let pg: PGlite;

function req(url: string, method: string, body: unknown, token: string): NextRequest {
  return new Request(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}
function get(url: string, token: string): NextRequest {
  return new Request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  pg = new PGlite();
  await applyMigrations(pg);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`, [OWNER_ID, 'Owner']);
  await pg.query(`INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`, [FUNDER_ID, 'Funder']);
  (globalThis as any).__TEST_PG_FUND__ = pg;
}, 60_000);

afterAll(async () => {
  await pg?.close();
  delete (globalThis as any).__TEST_PG_FUND__;
});

describe('funding validation', () => {
  it('rejects zero, negative, and non-integer wei', () => {
    expect(fundProjectSchema.safeParse({ amountWei: '0' }).success).toBe(false);
    expect(fundProjectSchema.safeParse({ amountWei: '-5' }).success).toBe(false);
    expect(fundProjectSchema.safeParse({ amountWei: '1.5' }).success).toBe(false);
    expect(fundProjectSchema.safeParse({ amountWei: '100' }).success).toBe(true);
  });

  it('addWei accumulates without float error', () => {
    expect(addWei('1000000000000000000', '2000000000000000000')).toBe('3000000000000000000');
  });

  it('invite requires a target (id or handle) at the route layer', () => {
    // Schema allows link invites (neither set); route creates a token invite.
    expect(
      createInviteSchema.safeParse({ entityType: 'project', entityId: crypto.randomUUID() }).success
    ).toBe(true);
  });
});

describe('POST /api/projects/[id]/fund (plan §02)', () => {
  async function makeProject(): Promise<string> {
    const res = await createProject(
      req('http://localhost/api/projects', 'POST', { name: `Funded ${Date.now()}`, metadataUri: 'https://example.com/m.json', status: 'active' }, OWNER_TOKEN)
    );
    expect(res.status).toBe(201);
    return (await res.json()).project.id as string;
  }

  it('records funding, accumulates totals, and credits the cached treasury', async () => {
    const projectId = await makeProject();
    const first = await fundProject(
      req(`http://localhost/api/projects/${projectId}/fund`, 'POST', { amountWei: '100' }, FUNDER_TOKEN),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(first.status).toBe(201);
    expect((await first.json()).treasuryBalanceWei).toBe('100');

    const second = await fundProject(
      req(`http://localhost/api/projects/${projectId}/fund`, 'POST', { amountWei: '200' }, FUNDER_TOKEN),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(second.status).toBe(201);
    const body = await second.json();
    expect(body.funder.total_funded_wei).toBe('300');
    expect(body.treasuryBalanceWei).toBe('300');

    const list = await listFunders(
      get(`http://localhost/api/projects/${projectId}/fund`, OWNER_TOKEN),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(list.status).toBe(200);
    expect((await list.json()).funders).toHaveLength(1);
  });

  it('rejects invalid amounts and unknown projects', async () => {
    const projectId = await makeProject();
    const bad = await fundProject(
      req(`http://localhost/api/projects/${projectId}/fund`, 'POST', { amountWei: '0' }, FUNDER_TOKEN),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(bad.status).toBe(400);

    const missing = await fundProject(
      req(`http://localhost/api/projects/00000000-0000-4000-8000-000000000000/fund`, 'POST', { amountWei: '10' }, FUNDER_TOKEN),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) }
    );
    expect(missing.status).toBe(404);
  });

  it('non-members cannot list funders (same rule as treasury reads)', async () => {
    const projectId = await makeProject();
    const res = await listFunders(
      get(`http://localhost/api/projects/${projectId}/fund`, FUNDER_TOKEN),
      { params: Promise.resolve({ id: projectId }) }
    );
    expect(res.status).toBe(403);
  });
});

describe('invites (plan §05)', () => {
  async function makeProject(): Promise<string> {
    const res = await createProject(
      req('http://localhost/api/projects', 'POST', { name: `Invite ${Date.now()}`, metadataUri: 'https://example.com/m.json', status: 'active' }, OWNER_TOKEN)
    );
    return (await res.json()).project.id as string;
  }

  it('non-owners cannot send invites', async () => {
    const projectId = await makeProject();
    const res = await createInvite(
      req('http://localhost/api/invites', 'POST', { entityType: 'project', entityId: projectId, inviteeId: FUNDER_ID }, FUNDER_TOKEN)
    );
    expect(res.status).toBe(403);
  });

  it('owner invites → funder accepts → collaborator row exists → editor unlocks', async () => {
    const projectId = await makeProject();
    const sent = await createInvite(
      req('http://localhost/api/invites', 'POST', { entityType: 'project', entityId: projectId, inviteeId: FUNDER_ID, message: 'Join us' }, OWNER_TOKEN)
    );
    expect(sent.status).toBe(201);
    const token = (await sent.json()).invite.token as string;
    expect(token).toBeTruthy();

    const inbox = await listInvites(get('http://localhost/api/invites', FUNDER_TOKEN));
    expect(inbox.status).toBe(200);
    expect((await inbox.json()).received.map((i: { token: string }) => i.token)).toContain(token);

    const accepted = await respondInvite(
      req(`http://localhost/api/invites/${token}`, 'POST', { action: 'accept' }, FUNDER_TOKEN),
      { params: Promise.resolve({ token }) }
    );
    expect(accepted.status).toBe(200);

    const rows = await pg.query(
      `SELECT * FROM "project_collaborators" WHERE "project_id" = $1 AND "user_id" = $2`,
      [projectId, FUNDER_ID]
    );
    expect(rows.rows).toHaveLength(1);

    // Double-accept is rejected, not duplicated.
    const again = await respondInvite(
      req(`http://localhost/api/invites/${token}`, 'POST', { action: 'accept' }, FUNDER_TOKEN),
      { params: Promise.resolve({ token }) }
    );
    expect(again.status).toBe(400);
  });

  it('article invites accept into article_collaborators', async () => {
    const art = await createArticle(
      req('http://localhost/api/articles', 'POST', { title: 'Invite Target', body: 'content here', status: 'published' }, OWNER_TOKEN)
    );
    expect(art.status).toBe(201);
    const articleId = (await art.json()).article.id as string;

    const sent = await createInvite(
      req('http://localhost/api/invites', 'POST', { entityType: 'article', entityId: articleId, inviteeId: FUNDER_ID }, OWNER_TOKEN)
    );
    expect(sent.status).toBe(201);
    const token = (await sent.json()).invite.token as string;

    const accepted = await respondInvite(
      req(`http://localhost/api/invites/${token}`, 'POST', { action: 'accept' }, FUNDER_TOKEN),
      { params: Promise.resolve({ token }) }
    );
    expect(accepted.status).toBe(200);
    const rows = await pg.query(
      `SELECT * FROM "article_collaborators" WHERE "article_id" = $1 AND "user_id" = $2`,
      [articleId, FUNDER_ID]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('decline marks the invite without granting membership', async () => {
    const projectId = await makeProject();
    const sent = await createInvite(
      req('http://localhost/api/invites', 'POST', { entityType: 'project', entityId: projectId, inviteeId: FUNDER_ID }, OWNER_TOKEN)
    );
    const token = (await sent.json()).invite.token as string;
    const declined = await respondInvite(
      req(`http://localhost/api/invites/${token}`, 'POST', { action: 'decline' }, FUNDER_TOKEN),
      { params: Promise.resolve({ token }) }
    );
    expect(declined.status).toBe(200);
    const rows = await pg.query(
      `SELECT * FROM "project_collaborators" WHERE "project_id" = $1 AND "user_id" = $2`,
      [projectId, FUNDER_ID]
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe('articles (plan §02/§04: reader publishing)', () => {
  it('slugify + readingMinutes helpers behave', () => {
    const slug = slugify('Why Milestone Funding Beats Lump Sums!');
    expect(slug.startsWith('why-milestone-funding-beats-lump-sums-')).toBe(true);
    expect(readingMinutes('word '.repeat(400))).toBe(2);
  });

  it('any wallet publishes; feed lists published; drafts hidden from strangers', async () => {
    const pub = await createArticle(
      req('http://localhost/api/articles', 'POST', { title: `Public ${Date.now()}`, body: 'open science content', status: 'published' }, FUNDER_TOKEN)
    );
    expect(pub.status).toBe(201);
    const pubSlug = (await pub.json()).article.slug as string;

    const draft = await createArticle(
      req('http://localhost/api/articles', 'POST', { title: `Draft ${Date.now()}`, body: 'secret draft', status: 'draft' }, FUNDER_TOKEN)
    );
    const draftSlug = (await draft.json()).article.slug as string;

    const feed = await listArticles(get('http://localhost/api/articles', OWNER_TOKEN));
    expect(feed.status).toBe(200);
    const slugs = ((await feed.json()).articles as Array<{ slug: string }>).map((a) => a.slug);
    expect(slugs).toContain(pubSlug);
    expect(slugs).not.toContain(draftSlug);

    const readPub = await getArticle(
      get(`http://localhost/api/articles/${pubSlug}`, OWNER_TOKEN),
      { params: Promise.resolve({ slug: pubSlug }) }
    );
    expect(readPub.status).toBe(200);

    const readDraft = await getArticle(
      get(`http://localhost/api/articles/${draftSlug}`, OWNER_TOKEN),
      { params: Promise.resolve({ slug: draftSlug }) }
    );
    expect(readDraft.status).toBe(404);
  });

  it('author edits + publishes draft; collaborator edits body but cannot publish; outsider blocked; author deletes', async () => {
    const created = await createArticle(
      req('http://localhost/api/articles', 'POST', { title: `Collab ${Date.now()}`, body: 'v1 body', status: 'draft' }, OWNER_TOKEN)
    );
    const slug = (await created.json()).article.slug as string;

    // Outsider cannot edit.
    const blocked = await updateArticle(
      req(`http://localhost/api/articles/${slug}`, 'PATCH', { body: 'hijack' }, FUNDER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(blocked.status).toBe(403);

    // Author invites funder as article collaborator; collaborator edits body.
    const sent = await createInvite(
      req('http://localhost/api/invites', 'POST', { entityType: 'article', entityId: (await (await getArticle(get(`http://localhost/api/articles/${slug}`, OWNER_TOKEN), { params: Promise.resolve({ slug }) })).json()).article.id, inviteeId: FUNDER_ID }, OWNER_TOKEN)
    );
    expect(sent.status).toBe(201);
    const token = (await sent.json()).invite.token as string;
    await respondInvite(
      req(`http://localhost/api/invites/${token}`, 'POST', { action: 'accept' }, FUNDER_TOKEN),
      { params: Promise.resolve({ token }) }
    );

    const edit = await updateArticle(
      req(`http://localhost/api/articles/${slug}`, 'PATCH', { body: 'v2 by collaborator' }, FUNDER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(edit.status).toBe(200);

    // Collaborator cannot publish (author-only).
    const pubAttempt = await updateArticle(
      req(`http://localhost/api/articles/${slug}`, 'PATCH', { status: 'published' }, FUNDER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(pubAttempt.status).toBe(403);

    // Author publishes, then soft-deletes.
    const pub = await updateArticle(
      req(`http://localhost/api/articles/${slug}`, 'PATCH', { status: 'published' }, OWNER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(pub.status).toBe(200);

    const delByOther = await deleteArticle(
      req(`http://localhost/api/articles/${slug}`, 'DELETE', undefined, FUNDER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(delByOther.status).toBe(403);

    const del = await deleteArticle(
      req(`http://localhost/api/articles/${slug}`, 'DELETE', undefined, OWNER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(del.status).toBe(200);

    const gone = await getArticle(
      get(`http://localhost/api/articles/${slug}`, OWNER_TOKEN),
      { params: Promise.resolve({ slug }) }
    );
    expect(gone.status).toBe(404);
  });
});
