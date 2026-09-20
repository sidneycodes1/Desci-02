import { NextRequest, NextResponse } from 'next/server';

import { getAppIdentity, type AppIdentity } from '@sciagent/auth/session';
import { getSupabaseAdminClient } from '@sciagent/shared/supabase/server';

/**
 * Authenticated request context for ALL user-facing API routes.
 *
 * Why this exists (real bug, Sep 2026): routes used to forward the raw Privy
 * access token to Supabase via `createSupabaseClientFromToken(token)` and use
 * `session.userId` (a `did:privy:...` DID) directly in uuid-typed filters.
 * That chain can never work — proven live against this project's Supabase:
 * PostgREST rejects foreign JWTs with 401 PGRST301 ("No suitable key or wrong
 * key type"), and comparing a uuid column to a DID string fails with 22P02.
 * Every authenticated call failed with 500 as a result.
 *
 * This helper bridges the two identity systems explicitly:
 *  1. Verify the Privy token (real verification, unchanged).
 *  2. Resolve the Privy DID to the internal `users.id` uuid — by linked
 *     wallet, provisioning a `users`+`wallets` row on first use so a fresh
 *     login gets 200-with-empty-list instead of an error.
 *  3. Hand routes the service-role client. RLS cannot apply to Privy
 *     identities (Supabase only knows Supabase-auth JWTs), so each route
 *     enforces its own owner/collaborator/admin checks in app code with
 *     `appUserId` — the existing per-route filters, now fed a real uuid.
 */
export interface AppSession {
  /** Raw verified Privy identity (userId is the `did:privy:...` DID). */
  identity: AppIdentity;
  /** Internal `users.id` uuid — use for EVERY database filter/insert. */
  appUserId: string;
  /** Service-role client. Authorization is enforced per-route, not by RLS. */
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  role: AppIdentity['role'];
}

export type AppSessionResult =
  | { ok: true; session: AppSession }
  | { ok: false; response: NextResponse };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Base Sepolia — matches the Privy/Wagmi default chain for this app. */
const DEFAULT_CHAIN_ID = 84532;

async function resolveAppUserId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  identity: AppIdentity
): Promise<string> {
  // UUID identities (test seam: `test_<uuid>` tokens) already are app user ids.
  if (UUID_RE.test(identity.userId)) {
    return identity.userId;
  }

  const wallet = identity.walletAddress;
  if (!wallet) {
    throw new Error(`Privy user ${identity.userId} has no linked wallet to map to a user row`);
  }

  // Returning user: linked wallet row points at the app user id.
  const { data: walletRow } = await supabase
    .from('wallets')
    .select('user_id')
    .eq('address', wallet)
    .single();
  if (walletRow?.user_id) {
    return walletRow.user_id as string;
  }

  // Older rows may carry the wallet on users.wallet_address instead.
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', wallet)
    .single();
  if (userRow?.id) {
    return userRow.id as string;
  }

  // First login: provision the identity row so the session is usable.
  // (Fresh logins must yield 200-with-empty-list, not 404/500.)
  const appUserId = crypto.randomUUID();
  const { error: userError } = await supabase.from('users').insert({
    id: appUserId,
    wallet_address: wallet,
  });
  if (userError) {
    throw new Error(`Failed to provision user row: ${userError.message}`);
  }
  const { error: walletError } = await supabase.from('wallets').insert({
    id: crypto.randomUUID(),
    user_id: appUserId,
    address: wallet,
    chain_id: DEFAULT_CHAIN_ID,
    is_primary: true,
  });
  if (walletError) {
    throw new Error(`Failed to provision wallet row: ${walletError.message}`);
  }
  console.info(`provisioned app user ${appUserId} for Privy ${identity.userId} (${wallet})`);
  return appUserId;
}

export async function requireAppSession(request: NextRequest): Promise<AppSessionResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 }),
    };
  }

  let identity: AppIdentity;
  try {
    identity = await getAppIdentity(authHeader.slice(7));
  } catch (error) {
    console.error('requireAppSession: Privy token verification failed:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }),
    };
  }

  const supabase = getSupabaseAdminClient();
  try {
    const appUserId = await resolveAppUserId(supabase, identity);
    return { ok: true, session: { identity, appUserId, supabase, role: identity.role } };
  } catch (error) {
    console.error('requireAppSession: identity resolution failed:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Failed to resolve user identity' }, { status: 500 }),
    };
  }
}
