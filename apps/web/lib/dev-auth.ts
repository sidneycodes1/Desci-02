/**
 * DEV-ONLY authentication helper.
 *
 * The frontend currently authenticates API calls with a hardcoded development
 * session token because the real Privy JWT flow is not wired into these pages
 * yet. See `KNOWN_LIMITATIONS.md` §3 — this MUST be replaced with the real
 * Privy `getAccessToken()` flow before any production deployment.
 *
 * Centralized here so the placeholder exists in exactly one place instead of
 * scattered string literals across pages.
 */
export const DEV_SESSION_TOKEN = 'mock_session_token_dev';

export function devAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${DEV_SESSION_TOKEN}`,
    ...extra,
  };
}
