import type { ProjectStatus } from '../validation/project';

export type { ProjectStatus };

/**
 * Project state machine with enforced transitions
 * 
 * Valid transitions:
 * - draft → active (project activation)
 * - active → completed (project completion)
 * - active → archived (project archival)
 * - completed → archived (archiving completed projects)
 * - draft → archived (archiving draft projects)
 * 
 * Invalid transitions:
 * - active → draft (cannot go back to draft)
 * - completed → active (cannot reactivate completed projects)
 * - archived → any state (archived is terminal)
 */
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['active', 'archived'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: [], // Terminal state
};

export function canTransitionStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function validateStatusTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canTransitionStatus(from, to)) {
    throw new Error(
      `Invalid status transition from ${from} to ${to}. Valid transitions from ${from}: ${VALID_TRANSITIONS[from].join(', ')}`
    );
  }
}

export function isTerminalStatus(status: ProjectStatus): boolean {
  return status === 'archived';
}

export function isActiveProject(status: ProjectStatus): boolean {
  return status === 'active';
}

export function isEditableProject(status: ProjectStatus): boolean {
  return status === 'draft';
}
