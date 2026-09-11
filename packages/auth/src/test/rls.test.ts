import { describe, expect, it } from 'vitest';

import { generateRlsPolicies, RLS_SQL } from '../rls';

describe('RLS policy generation', () => {
  it('generates correct number of policy blocks', () => {
    const sql = generateRlsPolicies(['projects', 'expenses']);
    const createPolicyCount = (sql.match(/CREATE POLICY/g) ?? []).length;
    expect(createPolicyCount).toBeGreaterThanOrEqual(2);
  });

  it('RLS_SQL contains ENABLE ROW LEVEL SECURITY', () => {
    expect(RLS_SQL).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('RLS_SQL contains auth.uid function', () => {
    expect(RLS_SQL).toContain('auth.uid()');
  });
});
