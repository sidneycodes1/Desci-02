import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getServerEnv } from '../env/server';
import type { SupabaseCookieAdapter } from './types';

/**
 * USER-SCOPED client (default for ALL user-triggered reads/writes).
 * Uses the publishable key + request cookies so Postgres RLS policies
 * scoped to `auth.uid()` are enforced. Phase 2 requires every query
 * against user or financial tables to go through this path — never the
 * admin client below — so RLS actually blocks unauthorized access.
 */
export function createSupabaseServerClient(cookieAdapter: SupabaseCookieAdapter) {
  const env = getServerEnv();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieAdapter.getAll();
        },
        setAll(cookies) {
          cookieAdapter.setAll(cookies);
        },
      },
    }
  );
}

let supabaseAdminClient: SupabaseClient | null = null;

/**
 * ADMIN client (service_role — BYPASSES RLS entirely).
 * Reserved EXPLICITLY for system/background jobs only (e.g. AI agent
 * writes from Phase 9, queue workers, reconciliation jobs with no user
 * JWT). MUST NOT be used in user-triggered API routes / server actions —
 * use `createSupabaseServerClient(cookieAdapter)` there so `auth.uid()`
 * RLS policies apply. Future phases: default to the scoped client out of
 * convenience is a security bug — flag any new `getSupabaseAdminClient`
 * call site in review.
 */
export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    const env = getServerEnv();
    supabaseAdminClient = createSupabaseJsClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdminClient;
}
