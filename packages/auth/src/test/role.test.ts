import { describe, expect, it } from 'vitest';

import { ROLE_PERMISSIONS, ROLE_HIERARCHY, hasRole, resolveRole, isHigherOrEqual } from '../role';

describe('Role hierarchy', () => {
  it('defines correct hierarchy', () => {
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.owner);
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.member);
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it('admin has all permissions', () => {
    expect(ROLE_PERMISSIONS.admin).toHaveLength(12);
  });

  it('viewer has no permissions', () => {
    expect(ROLE_PERMISSIONS.viewer).toHaveLength(0);
  });

  it('member/collaborator role is read-only for money and milestones', () => {
    expect(ROLE_PERMISSIONS.member).not.toContain('expense:propose');
    expect(ROLE_PERMISSIONS.member).not.toContain('milestone:create');
    expect(ROLE_PERMISSIONS.member).toHaveLength(0);
  });

  it('resolveRole maps strings correctly', () => {
    expect(resolveRole('admin')).toBe('admin');
    expect(resolveRole('OWNER')).toBe('owner');
    expect(resolveRole('member')).toBe('member');
    expect(resolveRole('viewer')).toBe('viewer');
    expect(resolveRole(undefined)).toBe('viewer');
    expect(resolveRole('unknown')).toBe('viewer');
  });

  it('hasRole checks hierarchy correctly', () => {
    expect(hasRole('admin', 'viewer')).toBe(true);
    expect(hasRole('viewer', 'admin')).toBe(false);
    expect(hasRole('owner', 'owner')).toBe(true);
  });

  it('isHigherOrEqual works correctly', () => {
    expect(isHigherOrEqual('admin', 'owner')).toBe(true);
    expect(isHigherOrEqual('owner', 'member')).toBe(true);
    expect(isHigherOrEqual('member', 'admin')).toBe(false);
    expect(isHigherOrEqual('viewer', 'viewer')).toBe(true);
  });
});
