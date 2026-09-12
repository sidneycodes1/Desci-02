'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';

import type { AuthUser } from '@sciagent/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready } = usePrivy();
  const [authState, _setAuthState] = useState<AuthUser | null>(null);

  const isLoading = !ready || authState === null;

  return (
    <AuthContext.Provider value={{ user: authState, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
