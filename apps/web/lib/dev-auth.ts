/**
 * Authentication helper for frontend API calls.
 *
 * When the user is logged in via Privy (see `app/auth/AuthProvider.tsx`),
 * calls carry the real Privy access token so API routes can verify the
 * session and enforce RLS as that user. When logged out (or in unit tests,
 * where no browser/Privy exists), calls fall back to the hardcoded
 * development session token — see `KNOWN_LIMITATIONS.md` §3, which MUST be
 * resolved (no logged-out access to authenticated routes) before any
 * production deployment.
 *
 * Centralized here so the placeholder exists in exactly one place instead of
 * scattered string literals across pages.
 */
export const DEV_SESSION_TOKEN = 'mock_session_token_dev';

let privyAccessToken: string | null = null;

/**
 * Called by `AuthProvider` whenever Privy auth state changes. Not reactive
 * on its own — `devAuthHeaders()` reads the latest value per call.
 */
export function setPrivyAccessToken(token: string | null): void {
  privyAccessToken = token;
}

export function devAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${privyAccessToken ?? DEV_SESSION_TOKEN}`,
    ...extra,
  };
}
