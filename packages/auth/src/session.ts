import { PrivyClient } from '@privy-io/server-auth';

import { getServerEnv } from '@sciagent/shared/env/server';
import { ROLE_PERMISSIONS, ROLE_HIERARCHY, Role, Permission, resolveRole } from './role';

export const PRIVY_AUDIENCE =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID ?? '';

export const ROLE_TO_PRIVY_METADATA_KEY = 'sciagent_role';

export interface PrivySession {
  userId: string;
  sessionId: string;
  appId: string;
  issuer: string;
  issuedAt: number;
  expiration: number;
  role: Role;
  permissions: Permission[];
  linkedAccounts: LinkAccount[];
  customMetadata: Record<string, unknown> | null;
}

export interface LinkAccount {
  type: string;
  address?: string;
  email?: string;
  phone?: string;
  walletId?: string;
  chainType?: string;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  sessionId: string;
  role: Role;
  permissions: Permission[];
  email: string | null;
  phone: string | null;
  walletAddress: string | null;
  linkedAccounts: LinkAccount[];
  isGuest: boolean;
  customMetadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface SessionClaims {
  sub: string;
  sid: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  sciagent_role?: string;
}

export function hasRole(user: AuthUser, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
}

export function isHigherOrEqual(role: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

export async function verifySession(
  token: string,
  privyClient?: PrivyClient
): Promise<PrivySession> {
  const client = privyClient ?? new PrivyClient(PRIVY_AUDIENCE, getServerEnv().PRIVY_APP_SECRET);
  const result = await client.verifyAuthToken(token);
  const user = await client.getUserFromIdToken(token);
  const role = resolveRole(user.customMetadata?.[ROLE_TO_PRIVY_METADATA_KEY] as string);
  return {
    userId: result.userId,
    sessionId: result.sessionId,
    appId: result.appId,
    issuer: result.issuer,
    issuedAt: result.issuedAt,
    expiration: result.expiration,
    role,
    permissions: ROLE_PERMISSIONS[role],
    linkedAccounts: user.linkedAccounts as unknown as LinkAccount[],
    customMetadata: user.customMetadata,
  };
}

export interface AppIdentity {
  /** Raw Privy user id (`did:privy:...`) — NOT a database uuid. */
  userId: string;
  sessionId: string;
  appId: string;
  role: Role;
  permissions: Permission[];
  /** Primary wallet address, if the Privy user has one linked. */
  walletAddress: string | null;
  linkedAccounts: LinkAccount[];
}

/**
 * Verify a Privy access token and extract the app-level identity in a single
 * Privy round trip (verify + user fetch). Unlike `verifySession` callers that
 * feed `userId` straight into uuid-typed DB columns, consumers MUST resolve
 * `userId` (a `did:privy:...` DID) to the internal `users.id` uuid first —
 * comparing a uuid column to a DID string fails in Postgres (22P02), and
 * Supabase PostgREST rejects Privy-signed JWTs outright (PGRST301), so the
 * raw token must never be forwarded as the Supabase Bearer.
 */
export async function getAppIdentity(
  token: string,
  privyClient?: PrivyClient
): Promise<AppIdentity> {
  const client = privyClient ?? new PrivyClient(PRIVY_AUDIENCE, getServerEnv().PRIVY_APP_SECRET);
  const result = await client.verifyAuthToken(token);
  const user = await client.getUserFromIdToken(token);
  const role = resolveRole(user.customMetadata?.[ROLE_TO_PRIVY_METADATA_KEY] as string);
  const linked = (user.linkedAccounts ?? []) as unknown as LinkAccount[];
  const walletAddress =
    user.wallet?.address ??
    (linked.find((a) => a.type === 'wallet' && typeof a.address === 'string')?.address as
      | string
      | undefined) ??
    null;
  return {
    userId: result.userId,
    sessionId: result.sessionId,
    appId: result.appId,
    role,
    permissions: ROLE_PERMISSIONS[role],
    walletAddress,
    linkedAccounts: linked,
  };
}
export async function getSessionUser(token: string, privyClient?: PrivyClient): Promise<AuthUser> {
  const session = await verifySession(token, privyClient);
  const client = privyClient ?? new PrivyClient(PRIVY_AUDIENCE, getServerEnv().PRIVY_APP_SECRET);
  const user = await client.getUserFromIdToken(token);
  const wallet = user.wallet?.address ?? null;
  return {
    id: session.userId,
    sessionId: session.sessionId,
    role: session.role,
    permissions: session.permissions,
    email: user.email?.address ?? null,
    phone: user.phone?.number ?? null,
    walletAddress: wallet,
    linkedAccounts: user.linkedAccounts as unknown as LinkAccount[],
    isGuest: user.isGuest,
    customMetadata: user.customMetadata,
    createdAt: new Date(user.createdAt),
  };
}

export async function invalidateSession(userId: string, privyClient?: PrivyClient): Promise<void> {
  const client = privyClient ?? new PrivyClient(PRIVY_AUDIENCE, getServerEnv().PRIVY_APP_SECRET);
  await client.deleteUser(userId);
}

/**
 * Test-only session verification for integration testing.
 * Only usable when NODE_ENV=test or TEST_MODE=true.
 * Returns a structurally valid fake session for testing API routes.
 */
export async function verifySessionTest(
  token: string,
  options?: { userId?: string; role?: Role }
): Promise<PrivySession> {
  if (process.env.NODE_ENV !== 'test' && process.env.TEST_MODE !== 'true') {
    throw new Error('verifySessionTest is only available in test mode');
  }

  // Parse token as "test_user_id" or use provided userId
  const userId = options?.userId || (token.startsWith('test_') ? token : 'test-user-id');
  const role = options?.role || 'owner';

  return {
    userId,
    sessionId: 'test-session-id',
    appId: PRIVY_AUDIENCE || 'test-app-id',
    issuer: 'test-issuer',
    issuedAt: Date.now(),
    expiration: Date.now() + 3600000, // 1 hour from now
    role,
    permissions: ROLE_PERMISSIONS[role],
    linkedAccounts: [],
    customMetadata: { [ROLE_TO_PRIVY_METADATA_KEY]: role },
  };
}
