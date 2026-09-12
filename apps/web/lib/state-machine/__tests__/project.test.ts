import { describe, expect, it } from 'vitest';

import {
  canTransitionStatus,
  validateStatusTransition,
  isTerminalStatus,
  isActiveProject,
  isEditableProject,
} from '../project';

describe('Project state machine', () => {
  describe('canTransitionStatus', () => {
    it('allows draft to active', () => {
      expect(canTransitionStatus('draft', 'active')).toBe(true);
    });

    it('allows draft to archived', () => {
      expect(canTransitionStatus('draft', 'archived')).toBe(true);
    });

    it('allows active to completed', () => {
      expect(canTransitionStatus('active', 'completed')).toBe(true);
    });

    it('allows active to archived', () => {
      expect(canTransitionStatus('active', 'archived')).toBe(true);
    });

    it('allows completed to archived', () => {
      expect(canTransitionStatus('completed', 'archived')).toBe(true);
    });

    it('rejects active to draft', () => {
      expect(canTransitionStatus('active', 'draft')).toBe(false);
    });

    it('rejects completed to active', () => {
      expect(canTransitionStatus('completed', 'active')).toBe(false);
    });

    it('rejects archived to any state', () => {
      expect(canTransitionStatus('archived', 'draft')).toBe(false);
      expect(canTransitionStatus('archived', 'active')).toBe(false);
      expect(canTransitionStatus('archived', 'completed')).toBe(false);
    });

    it('rejects same status transition', () => {
      expect(canTransitionStatus('draft', 'draft')).toBe(false);
      expect(canTransitionStatus('active', 'active')).toBe(false);
    });
  });

  describe('validateStatusTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => validateStatusTransition('draft', 'active')).not.toThrow();
      expect(() => validateStatusTransition('active', 'completed')).not.toThrow();
    });

    it('throws for invalid transitions', () => {
      expect(() => validateStatusTransition('active', 'draft')).toThrow(
        'Invalid status transition from active to draft'
      );
      expect(() => validateStatusTransition('archived', 'active')).toThrow(
        'Invalid status transition from archived to active'
      );
    });

    it('includes valid transitions in error message', () => {
      try {
        validateStatusTransition('active', 'draft');
      } catch (error) {
        expect((error as Error).message).toContain('completed');
        expect((error as Error).message).toContain('archived');
      }
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true for archived', () => {
      expect(isTerminalStatus('archived')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('active')).toBe(false);
      expect(isTerminalStatus('completed')).toBe(false);
    });
  });

  describe('isActiveProject', () => {
    it('returns true for active', () => {
      expect(isActiveProject('active')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isActiveProject('draft')).toBe(false);
      expect(isActiveProject('completed')).toBe(false);
      expect(isActiveProject('archived')).toBe(false);
    });
  });

  describe('isEditableProject', () => {
    it('returns true for draft', () => {
      expect(isEditableProject('draft')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isEditableProject('active')).toBe(false);
      expect(isEditableProject('completed')).toBe(false);
      expect(isEditableProject('archived')).toBe(false);
    });
  });
});
