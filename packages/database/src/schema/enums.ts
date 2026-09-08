import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['researcher', 'reviewer', 'admin']);

export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const milestoneStateEnum = pgEnum('milestone_state', ['created', 'submitted', 'approved']);

export const expenseStatusEnum = pgEnum('expense_status', [
  'proposed',
  'approved',
  'executed',
  'failed',
]);

export const agentNameEnum = pgEnum('agent_name', ['tracker', 'spending', 'milestone']);

export const agentRunStatusEnum = pgEnum('agent_run_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'needs_review',
]);
