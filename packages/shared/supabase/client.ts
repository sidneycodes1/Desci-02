import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getClientEnv } from '../env/client';

let browserSupabaseClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!browserSupabaseClient) {
    const env = getClientEnv();
    browserSupabaseClient = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }

  return browserSupabaseClient;
}

export function createSupabaseBrowserClient() {
  const env = getClientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
