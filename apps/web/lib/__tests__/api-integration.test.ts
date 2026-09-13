/**
 * Route-level persistence integration test — proves frontend-to-backend wiring
 * WITHOUT live Privy/Supabase credentials.
 *
 * Pattern (mirrors packages/database/test/rls.test.ts PGlite usage):
 * - verifySession() is replaced by a TEST-MODE-ONLY double (vi.mock, gated on
 *   NODE_ENV=test / TEST_MODE=true). The real auth check is untouched in prod;
 *   the double throws outside test mode (covered by a test below).
 * - createSupabaseClientFromToken() is replaced by a minimal PostgREST-like
 *   shim backed by a REAL in-memory PGlite Postgres (migrations applied).
 * - The test imports and calls the REAL route handlers
 *   (app/api/projects/route, .../[id]/logs/route, .../[id]/milestones/route,
 *   user profile/settings/preferences routes, project settings route),
 *   then does a FRESH direct DB query (and a fresh GET route call) to confirm
 *   the exact returned ID actually persisted.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test shim deals in dynamic Supabase/PGlite row shapes */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';

(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

const TEST_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEST_TOKEN = `test_${TEST_USER_ID}`;

// ---------------------------------------------------------------------------
// Test doubles (injected deps — prod code untouched, unreachable outside test)
// ---------------------------------------------------------------------------

vi.mock('@sciagent/auth/session', () => ({
  verifySession: async (token: string) => {
    if (process.env.NODE_ENV !== 'test' && process.env.TEST_MODE !== 'true') {
      throw new Error('test double only available in test mode');
    }
    if (!token || typeof token !== 'string' || token.length === 0) {
      throw new Error('Missing token');
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let userId = TEST_USER_ID;
    if (token.startsWith('test_')) {
      const maybe = token.slice('test_'.length);
      if (uuidRe.test(maybe)) userId = maybe;
    } else if (uuidRe.test(token)) {
      userId = token;
    }
    return {
      userId,
      sessionId: 'test-session-id',
      appId: 'test-app-id',
      issuer: 'test-issuer',
      issuedAt: Date.now(),
      expiration: Date.now() + 3600_000,
      role: 'owner',
      permissions: ['project:create', 'project:read', 'log:create', 'milestone:create'],
      linkedAccounts: [],
      customMetadata: { sciagent_role: 'owner' },
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

    constructor(pg: any, table: string) {
      this.pg = pg;
      this.table = table;
    }

    select(cols: string = '*'): this {
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
      // Join select used only by GET /api/projects collaborator branch.
      // Fresh test user has no collaborations -> empty is the correct answer.
      if (
        this.table === 'project_collaborators' &&
        typeof this.selectCols === 'string' &&
        this.selectCols.includes('projects(')
      ) {
        return { data: [], error: null };
      }

      if (this.insertRows) {
        const row: Record<string, unknown> = { ...(this.insertRows[0] ?? {}) };
        if (!row.id) {
          row.id = crypto.randomUUID();
        }
        const cols = Object.keys(row);
        const values = cols.map((c) => row[c] ?? null);
        const sql =
          `INSERT INTO "${this.table}" (${cols.map((c) => qid(c)).join(', ')}) ` +
          `VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
        const res = await this.pg.query(sql, values);
        if (this.wantSingle) {
          return { data: res.rows[0] ?? null, error: null };
        }
        return { data: res.rows, error: null };
      }

      if (this.updatePatch) {
        const cols = Object.keys(this.updatePatch);
        const params: unknown[] = cols.map(
          (c) => (this.updatePatch as Record<string, unknown>)[c] ?? null
        );
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
          if (res.rows.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
          }
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }

      let sql = `SELECT * FROM "${this.table}"`;
      const params: unknown[] = [];
      const wheres: string[] = [];
      for (const f of this.filters) {
        if (f.col.includes('.')) continue; // joined-table predicate: not on base table
        if (f.op === 'eq') {
          params.push(f.val);
          wheres.push(`${qid(f.col)} = $${params.length}`);
        } else {
          if (f.val === null) {
            wheres.push(`${qid(f.col)} IS NULL`);
          } else {
            params.push(f.val);
            wheres.push(`${qid(f.col)} IS NOT DISTINCT FROM $${params.length}`);
          }
        }
      }
      if (wheres.length > 0) sql += ` WHERE ${wheres.join(' AND ')}`;
      const cleanOrders = this.orders.filter((o) => !o.col.includes('.'));
      if (cleanOrders.length > 0) {
        sql += ` ORDER BY ${cleanOrders.map((o) => `${qid(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ')}`;
      }
      const res = await this.pg.query(sql, params);
      if (this.wantSingle) {
        if (res.rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        }
        return { data: res.rows[0], error: null };
      }
      return { data: res.rows, error: null };
    }
  }

  return {
    createSupabaseClientFromToken: (_token: string) => {
      const pg = (globalThis as any).__TEST_PG__;
      if (!pg) {
        throw new Error('PGlite test DB not initialized (globalThis.__TEST_PG__ missing)');
      }
      return {
        from: (table: string) => new Builder(pg, table),
      };
    },
  };
});

// Real route handlers under test (imports resolve to the mocks above).
import { verifySession } from '@sciagent/auth/session';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../../../../packages/database/src/seed';
import { GET as listProjects, POST as createProject } from '../../app/api/projects/route';
import { GET as listLogs, POST as createLog } from '../../app/api/projects/[id]/logs/route';
import {
  GET as listMilestones,
  POST as createMilestone,
} from '../../app/api/projects/[id]/milestones/route';
import { GET as getProfile, PUT as updateProfile } from '../../app/api/user/profile/route';
import {
  GET as getUserSettings,
  PUT as updateUserSettings,
} from '../../app/api/user/settings/route';
import {
  GET as getPreferences,
  PUT as updatePreferences,
} from '../../app/api/user/notifications/preferences/route';
import {
  GET as getProjectSettings,
  PUT as updateProjectSettings,
} from '../../app/api/projects/[id]/settings/route';

let pg: PGlite;

const TEST_WALLET_1 = '0x1111111111111111111111111111111111111111';
const TEST_WALLET_2 = '0x2222222222222222222222222222222222222222';

function authedJsonRequest(
  url: string,
  method: string,
  body: unknown,
  token = TEST_TOKEN
): NextRequest {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

function authedGetRequest(url: string, token = TEST_TOKEN): NextRequest {
  return new Request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }) as unknown as NextRequest;
}

function paramsFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeAll(async () => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  pg = new PGlite();
  await applyMigrations(pg);
  await pg.query(
    `INSERT INTO "users" ("id", "display_name", "role") VALUES ($1, $2, 'researcher') ON CONFLICT ("id") DO NOTHING`,
    [TEST_USER_ID, 'Test Owner']
  );
  await pg.query(
    `INSERT INTO "wallets" ("id", "user_id", "address", "chain_id", "is_primary") VALUES ($1, $2, $3, 84532, true) ON CONFLICT ("id") DO NOTHING`,
    [crypto.randomUUID(), TEST_USER_ID, TEST_WALLET_1]
  );
  await pg.query(
    `INSERT INTO "wallets" ("id", "user_id", "address", "chain_id", "is_primary") VALUES ($1, $2, $3, 84532, false) ON CONFLICT ("id") DO NOTHING`,
    [crypto.randomUUID(), TEST_USER_ID, TEST_WALLET_2]
  );
  (globalThis as any).__TEST_PG__ = pg;
}, 60_000);

afterAll(async () => {
  await pg?.close();
  delete (globalThis as any).__TEST_PG__;
});

describe('test doubles are safely gated', () => {
  it('verifySession double returns a structurally-valid fake session in test mode', async () => {
    const session = await verifySession(TEST_TOKEN);
    expect(session.userId).toBe(TEST_USER_ID);
    expect(session.role).toBe('owner');
    expect(session.sessionId).toBeTruthy();
    expect(session.appId).toBeTruthy();
    expect(session.expiration).toBeGreaterThan(Date.now());
    expect(Array.isArray(session.permissions)).toBe(true);
  });

  it('verifySession double is unreachable outside test mode', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevTestMode = process.env.TEST_MODE;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.TEST_MODE = 'false';
    try {
      await expect(verifySession(TEST_TOKEN)).rejects.toThrow(
        'test double only available in test mode'
      );
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prevNodeEnv as string;
      process.env.TEST_MODE = prevTestMode;
    }
  });

  it('real route still enforces auth: missing Bearer header -> 401', async () => {
    const unauthed = new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope', metadataUri: 'https://example.com/m.json' }),
    }) as unknown as NextRequest;
    const res = await createProject(unauthed);
    expect(res.status).toBe(401);
  });
});

describe('API persistence via REAL route handlers (PGlite, no live creds)', () => {
  it('POST /api/projects persists; fresh direct query + fresh GET see the same ID', async () => {
    const name = `Route Project ${Date.now()}`;
    const postRes = await createProject(
      authedJsonRequest('http://localhost/api/projects', 'POST', {
        name,
        metadataUri: 'https://example.com/meta.json',
        status: 'draft',
      })
    );
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    const projectId: string = postJson.project.id;
    expect(projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Fresh direct DB query by the REAL returned ID (not a re-implementation).
    const direct = await pg.query(`SELECT * FROM "projects" WHERE "id" = $1`, [projectId]);
    expect(direct.rows).toHaveLength(1);
    expect((direct.rows[0] as any).name).toBe(name);
    expect((direct.rows[0] as any).owner_user_id).toBe(TEST_USER_ID);

    // Fresh GET route call sees the same project.
    const getRes = await listProjects(authedGetRequest('http://localhost/api/projects'));
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    const ids = (getJson.projects as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(projectId);
  });

  it('POST /api/projects/[id]/logs persists; fresh query + fresh GET see the same ID', async () => {
    const projectRes = await createProject(
      authedJsonRequest('http://localhost/api/projects', 'POST', {
        name: `Log Parent ${Date.now()}`,
        metadataUri: 'https://example.com/log-parent.json',
        status: 'active',
      })
    );
    expect(projectRes.status).toBe(201);
    const projectId: string = (await projectRes.json()).project.id;

    const title = `Route Log ${Date.now()}`;
    const logRes = await createLog(
      authedJsonRequest(`http://localhost/api/projects/${projectId}/logs`, 'POST', {
        title,
        content: 'Proving research-log persistence through the real handler.',
      }),
      paramsFor(projectId)
    );
    expect(logRes.status).toBe(201);
    const logId: string = (await logRes.json()).log.id;
    expect(logId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const direct = await pg.query(`SELECT * FROM "research_logs" WHERE "id" = $1`, [logId]);
    expect(direct.rows).toHaveLength(1);
    expect((direct.rows[0] as any).title).toBe(title);
    expect((direct.rows[0] as any).project_id).toBe(projectId);
    expect((direct.rows[0] as any).author_user_id).toBe(TEST_USER_ID);

    const getRes = await listLogs(
      authedGetRequest(`http://localhost/api/projects/${projectId}/logs`),
      paramsFor(projectId)
    );
    expect(getRes.status).toBe(200);
    const ids = ((await getRes.json()).logs as Array<{ id: string }>).map((l) => l.id);
    expect(ids).toContain(logId);
  });

  it('POST /api/projects/[id]/milestones persists; fresh query + fresh GET see the same ID', async () => {
    const projectRes = await createProject(
      authedJsonRequest('http://localhost/api/projects', 'POST', {
        name: `Milestone Parent ${Date.now()}`,
        metadataUri: 'https://example.com/ms-parent.json',
        status: 'active',
      })
    );
    expect(projectRes.status).toBe(201);
    const projectId: string = (await projectRes.json()).project.id;

    const title = `Route Milestone ${Date.now()}`;
    const msRes = await createMilestone(
      authedJsonRequest(`http://localhost/api/projects/${projectId}/milestones`, 'POST', {
        title,
        descriptionUri: 'https://example.com/milestone-desc.json',
      }),
      paramsFor(projectId)
    );
    expect(msRes.status).toBe(201);
    const milestoneId: string = (await msRes.json()).milestone.id;
    expect(milestoneId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const direct = await pg.query(`SELECT * FROM "milestones" WHERE "id" = $1`, [milestoneId]);
    expect(direct.rows).toHaveLength(1);
    expect((direct.rows[0] as any).title).toBe(title);
    expect((direct.rows[0] as any).project_id).toBe(projectId);
    expect((direct.rows[0] as any).state).toBe('created');

    const getRes = await listMilestones(
      authedGetRequest(`http://localhost/api/projects/${projectId}/milestones`),
      paramsFor(projectId)
    );
    expect(getRes.status).toBe(200);
    const ids = ((await getRes.json()).milestones as Array<{ id: string }>).map((m) => m.id);
    expect(ids).toContain(milestoneId);
  });
});

describe('Phase 12/13 repairs via REAL route handlers (PGlite, no live creds)', () => {
  it('PUT /api/user/profile persists validated fields (was: silently dropped)', async () => {
    const putRes = await updateProfile(
      authedJsonRequest('http://localhost/api/user/profile', 'PUT', {
        displayName: 'Dr. Test Owner',
        bio: 'Open-science researcher.',
        orcidId: '0000-0002-1825-0097',
      })
    );
    expect(putRes.status).toBe(200);

    const direct = await pg.query(
      `SELECT "display_name", "bio", "orcid_id" FROM "users" WHERE "id" = $1`,
      [TEST_USER_ID]
    );
    expect(direct.rows).toHaveLength(1);
    expect((direct.rows[0] as any).display_name).toBe('Dr. Test Owner');
    expect((direct.rows[0] as any).bio).toBe('Open-science researcher.');
    expect((direct.rows[0] as any).orcid_id).toBe('0000-0002-1825-0097');

    const getRes = await getProfile(authedGetRequest('http://localhost/api/user/profile'));
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).profile.display_name).toBe('Dr. Test Owner');
  });

  it('PUT /api/user/profile rejects a bad ORCID instead of storing it', async () => {
    const putRes = await updateProfile(
      authedJsonRequest('http://localhost/api/user/profile', 'PUT', { orcidId: 'not-an-orcid' })
    );
    expect(putRes.status).toBe(400);
  });

  it('PUT /api/user/settings persists displayName/bio and switches primary wallet', async () => {
    const putRes = await updateUserSettings(
      authedJsonRequest('http://localhost/api/user/settings', 'PUT', {
        displayName: 'Settings Owner',
        bio: 'Settings bio.',
        primaryWalletAddress: TEST_WALLET_2,
      })
    );
    expect(putRes.status).toBe(200);

    const userRows = await pg.query(`SELECT "display_name", "bio" FROM "users" WHERE "id" = $1`, [
      TEST_USER_ID,
    ]);
    expect((userRows.rows[0] as any).display_name).toBe('Settings Owner');
    expect((userRows.rows[0] as any).bio).toBe('Settings bio.');

    const walletRows = await pg.query(
      `SELECT "address", "is_primary" FROM "wallets" WHERE "user_id" = $1 ORDER BY "address"`,
      [TEST_USER_ID]
    );
    const byAddress = new Map(
      (walletRows.rows as Array<any>).map((w) => [w.address as string, w.is_primary as boolean])
    );
    expect(byAddress.get(TEST_WALLET_2)).toBe(true);
    expect(byAddress.get(TEST_WALLET_1)).toBe(false);

    const getRes = await getUserSettings(authedGetRequest('http://localhost/api/user/settings'));
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).settings.display_name).toBe('Settings Owner');
  });

  it('PUT /api/user/settings rejects a wallet the user does not own', async () => {
    const putRes = await updateUserSettings(
      authedJsonRequest('http://localhost/api/user/settings', 'PUT', {
        displayName: 'Settings Owner',
        primaryWalletAddress: '0x9999999999999999999999999999999999999999',
      })
    );
    expect(putRes.status).toBe(404);
  });

  it('PUT /api/user/notifications/preferences validates and persists', async () => {
    const badRes = await updatePreferences(
      authedJsonRequest('http://localhost/api/user/notifications/preferences', 'PUT', {
        emailAlerts: 'yes',
      })
    );
    expect(badRes.status).toBe(400);

    const emptyRes = await updatePreferences(
      authedJsonRequest('http://localhost/api/user/notifications/preferences', 'PUT', {})
    );
    expect(emptyRes.status).toBe(400);

    const putRes = await updatePreferences(
      authedJsonRequest('http://localhost/api/user/notifications/preferences', 'PUT', {
        emailAlerts: true,
        milestoneAlerts: false,
      })
    );
    expect(putRes.status).toBe(200);
    expect((await putRes.json()).preferences.emailAlerts).toBe(true);

    const getRes = await getPreferences(
      authedGetRequest('http://localhost/api/user/notifications/preferences')
    );
    expect(getRes.status).toBe(200);
    const prefs = (await getRes.json()).preferences;
    expect(prefs.emailAlerts).toBe(true);
    expect(prefs.milestoneAlerts).toBe(false);
  });

  it('PUT /api/projects/[id]/settings persists and enforces the state machine', async () => {
    const projectRes = await createProject(
      authedJsonRequest('http://localhost/api/projects', 'POST', {
        name: `Settings Parent ${Date.now()}`,
        metadataUri: 'https://example.com/settings-parent.json',
        status: 'draft',
      })
    );
    expect(projectRes.status).toBe(201);
    const projectId: string = (await projectRes.json()).project.id;

    const newName = `Renamed ${Date.now()}`;
    const putRes = await updateProjectSettings(
      authedJsonRequest(`http://localhost/api/projects/${projectId}/settings`, 'PUT', {
        name: newName,
        metadataUri: 'https://example.com/settings-renamed.json',
        status: 'active',
      }),
      paramsFor(projectId)
    );
    expect(putRes.status).toBe(200);

    const direct = await pg.query(`SELECT "name", "status" FROM "projects" WHERE "id" = $1`, [
      projectId,
    ]);
    expect((direct.rows[0] as any).name).toBe(newName);
    expect((direct.rows[0] as any).status).toBe('active');

    const getRes = await getProjectSettings(
      authedGetRequest(`http://localhost/api/projects/${projectId}/settings`),
      paramsFor(projectId)
    );
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).settings.name).toBe(newName);

    // active -> draft is an illegal transition: must be rejected, row unchanged.
    const badRes = await updateProjectSettings(
      authedJsonRequest(`http://localhost/api/projects/${projectId}/settings`, 'PUT', {
        name: newName,
        metadataUri: 'https://example.com/settings-renamed.json',
        status: 'draft',
      }),
      paramsFor(projectId)
    );
    expect(badRes.status).toBe(400);
    const after = await pg.query(`SELECT "status" FROM "projects" WHERE "id" = $1`, [projectId]);
    expect((after.rows[0] as any).status).toBe('active');
  });
});
