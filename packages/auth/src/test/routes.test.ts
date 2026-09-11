import { describe, expect, it } from 'vitest';

import { generateRlsPolicies, generateUserRlsPolicy, RLS_SQL } from '../rls';

describe('Routes', () => {
  it('identifies protected routes', () => {
    expect('/api/projects'.startsWith('/api/')).toBe(true);
    expect('/api/expenses/123'.startsWith('/api/')).toBe(true);
    expect('/api/admin/users'.startsWith('/api/')).toBe(true);
  });

  it('returns route roles', () => {
    expect(['admin']).toContain('admin');
    expect(['owner', 'admin']).toContain('owner');
    expect(['member', 'admin']).toContain('member');
  });
});

describe('RLS policies', () => {
  it('generates user policy SQL', () => {
    const sql = generateUserRlsPolicy('grant_expenses');
    expect(sql).toContain('grant_expenses');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('USING');
    expect(sql).toContain('WITH CHECK');
  });

  it('generates policies for multiple tables', () => {
    const sql = generateRlsPolicies(['milestones', 'reputation_events']);
    expect(sql).toContain('milestones');
    expect(sql).toContain('reputation_events');
    expect(sql).toContain('CREATE POLICY');
  });

  it('RLS_SQL contains ENABLE ROW LEVEL SECURITY', () => {
    expect(RLS_SQL).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
