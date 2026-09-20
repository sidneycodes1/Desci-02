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
    expect(ROLE_PERMISSIONS.admin).toContain('project:create');
    expect(ROLE_PERMISSIONS.admin).toContain('project:update');
    expect(ROLE_PERMISSIONS.admin).toContain('project:delete');
    expect(ROLE_PERMISSIONS.admin).toContain('expense:propose');
    expect(ROLE_PERMISSIONS.admin).toContain('expense:approve');
    expect(ROLE_PERMISSIONS.admin).toContain('expense:execute');
    expect(ROLE_PERMISSIONS.admin).toContain('milestone:create');
    expect(ROLE_PERMISSIONS.admin).toContain('milestone:approve');
    expect(ROLE_PERMISSIONS.admin).toContain('reputation:write');
    expect(ROLE_PERMISSIONS.admin).toContain('admin:manage_users');
    expect(ROLE_PERMISSIONS.admin).toContain('admin:manage_roles');
    expect(ROLE_PERMISSIONS.admin).toContain('admin:pause_all');
  });

  it('owner has project, expense, milestone, and reputation permissions', () => {
    expect(ROLE_PERMISSIONS.owner).toContain('project:create');
    expect(ROLE_PERMISSIONS.owner).toContain('project:update');
    expect(ROLE_PERMISSIONS.owner).toContain('project:delete');
    expect(ROLE_PERMISSIONS.owner).toContain('expense:propose');
    expect(ROLE_PERMISSIONS.owner).toContain('expense:approve');
    expect(ROLE_PERMISSIONS.owner).toContain('expense:execute');
    expect(ROLE_PERMISSIONS.owner).toContain('milestone:create');
    expect(ROLE_PERMISSIONS.owner).toContain('milestone:approve');
    expect(ROLE_PERMISSIONS.owner).toContain('reputation:write');
    expect(ROLE_PERMISSIONS.owner).not.toContain('admin:manage_users');
    expect(ROLE_PERMISSIONS.owner).not.toContain('admin:manage_roles');
    expect(ROLE_PERMISSIONS.owner).not.toContain('admin:pause_all');
  });

  it('viewer has no permissions', () => {
    expect(ROLE_PERMISSIONS.viewer).toHaveLength(0);
  });

  it('member/collaborator role is read-only for money and milestones', () => {
    // CRITICAL: These must not be included - member role is read-only for treasury & milestone actions
    expect(ROLE_PERMISSIONS.member).not.toContain('expense:propose');
    expect(ROLE_PERMISSIONS.member).not.toContain('expense:approve');
    expect(ROLE_PERMISSIONS.member).not.toContain('expense:execute');
    expect(ROLE_PERMISSIONS.member).not.toContain('milestone:create');
    expect(ROLE_PERMISSIONS.member).not.toContain('milestone:approve');
    expect(ROLE_PERMISSIONS.member).not.toContain('project:create');
    expect(ROLE_PERMISSIONS.member).not.toContain('project:update');
    expect(ROLE_PERMISSIONS.member).not.toContain('project:delete');
    expect(ROLE_PERMISSIONS.member).not.toContain('reputation:write');
    expect(ROLE_PERMISSIONS.member).toHaveLength(0);
  });

  it('permission matrix cannot silently drift - explicit lock test', () => {
    // This test explicitly locks in the permission matrix to prevent silent drift
    // If any of these assertions fail, it means the permission matrix has changed
    // and needs to be reviewed against the docs/AUTH.md documentation

    // Admin: 12 permissions (all)
    expect(ROLE_PERMISSIONS.admin.length).toBe(12);

    // Owner: 9 permissions (project, expense, milestone, reputation - no admin ops)
    expect(ROLE_PERMISSIONS.owner.length).toBe(9);

    // Member: 0 permissions (read-only for treasury & milestone)
    expect(ROLE_PERMISSIONS.member.length).toBe(0);

    // Viewer: 0 permissions (read-only)
    expect(ROLE_PERMISSIONS.viewer.length).toBe(0);

    // Critical: Member cannot propose expenses or create milestones
    expect(ROLE_PERMISSIONS.member).not.toContain('expense:propose');
    expect(ROLE_PERMISSIONS.member).not.toContain('milestone:create');
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
