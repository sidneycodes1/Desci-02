'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';

import type { AuthUser } from '@sciagent/auth';

import { setPrivyAccessToken } from '../../lib/dev-auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /**
   * The live Privy access token, or null while logged out / still resolving.
   * Pages MUST gate authenticated fetches on this (React Query `enabled`)
   * and send it as the Bearer explicitly. Reading it from context (instead
   * of the module-level bridge in lib/dev-auth) makes data fetching react to
   * login/logout/account-switch instead of firing once with a stale token.
   */
  accessToken: string | null;
  /** Raw Privy authentication flag (true before the token resolves). */
  authenticated: boolean;
  /** Privy SDK readiness — gates "logged out" UI so we don't flash it. */
  authReady: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  accessToken: null,
  authenticated: false,
  authReady: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [authState, _setAuthState] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Keep API calls authenticated as the Privy user: whenever auth state
  // changes, refresh the token that callers attach. Null while logged out or
  // still resolving — callers must NOT fall back to a placeholder token here
  // (a wrong token fails closed at the API with 401, which React Query would
  // then cache as a permanent error state for the session).
  useEffect(() => {
    if (!ready || !authenticated) {
      setPrivyAccessToken(null);
      setAccessToken(null);
      return;
    }
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (cancelled) return;
        setPrivyAccessToken(token);
        setAccessToken(token);
      })
      .catch(() => {
        if (cancelled) return;
        setPrivyAccessToken(null);
        setAccessToken(null);
      });
    return () => {
      cancelled = true;
    };
    // `user` re-runs token resolution on account switch inside Privy.
  }, [ready, authenticated, user, getAccessToken]);

  const isLoading = !ready || authState === null;

  return (
    <AuthContext.Provider
      value={{ user: authState, isLoading, accessToken, authenticated, authReady: ready }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
