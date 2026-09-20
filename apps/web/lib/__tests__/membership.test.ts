/**
 * Plan §02 — the one hard rule: anyone can read, only owner + invited
 * collaborators can edit. Membership is a per-project relationship.
 */
import { describe, expect, it } from 'vitest';

import {
  canApproveFunds,
  canDeleteProject,
  canEditProject,
  canInvite,
  editorGuardRedirect,
  getProjectRelation,
} from '../membership';

const OWNER = 'owner-uuid';
const OTHER = 'other-uuid';

describe('per-project membership (plan §02)', () => {
  it('owner can edit, invite, approve funds, delete', () => {
    const m = { ownerUserId: OWNER, appUserId: OWNER, isCollaborator: false };
    expect(getProjectRelation(m)).toBe('owner');
    expect(canEditProject(m)).toBe(true);
    expect(canInvite(m)).toBe(true);
    expect(canApproveFunds(m)).toBe(true);
    expect(canDeleteProject(m)).toBe(true);
  });

  it('invited collaborator can edit but cannot invite, approve funds, or delete', () => {
    const m = { ownerUserId: OWNER, appUserId: OTHER, isCollaborator: true };
    expect(getProjectRelation(m)).toBe('collaborator');
    expect(canEditProject(m)).toBe(true);
    expect(canInvite(m)).toBe(false);
    expect(canApproveFunds(m)).toBe(false);
    expect(canDeleteProject(m)).toBe(false);
  });

  it('reader cannot edit, invite, or delete; funder-of-record can approve funds', () => {
    const reader = { ownerUserId: OWNER, appUserId: OTHER, isCollaborator: false };
    expect(getProjectRelation(reader)).toBe('reader');
    expect(canEditProject(reader)).toBe(false);
    expect(canInvite(reader)).toBe(false);
    expect(canDeleteProject(reader)).toBe(false);
    expect(canApproveFunds({ ...reader, isFunder: true })).toBe(true);
  });

  it('editor guard sends non-editors to the read-only page', () => {
    expect(
      editorGuardRedirect(
        { ownerUserId: OWNER, appUserId: OTHER, isCollaborator: false },
        '/projects/p1'
      )
    ).toBe('/projects/p1');
    expect(
      editorGuardRedirect(
        { ownerUserId: OWNER, appUserId: OTHER, isCollaborator: true },
        '/projects/p1'
      )
    ).toBeNull();
  });
});
