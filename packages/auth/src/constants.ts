export const ROLE_TO_PRIVY_METADATA_KEY = 'sciagent_role';
export const PRIVY_AUDIENCE =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID ?? '';
export const AUTH_COOKIE_NAME = 'sciagent_session';
export const REFRESH_COOKIE_NAME = 'sciagent_refresh';
export const TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TTL_SECONDS = 604800;

export const MILESTONE_STATES = ['Draft', 'Submitted', 'Approved', 'Completed', 'Rejected'] as const;
export type MilestoneState = (typeof MILESTONE_STATES)[number];

export const PROJECT_STATES = ['Active', 'Paused', 'Completed', 'Cancelled'] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];
