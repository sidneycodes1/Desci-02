import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getServerEnv } from '../env/server';
import type { SupabaseCookieAdapter } from './types';

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
