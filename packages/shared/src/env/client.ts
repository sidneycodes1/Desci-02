import { z } from 'zod';

import { nodeEnvSchema, parseEnvironment, trimmedString, urlSchema } from './shared';

export const clientEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_APP_URL: urlSchema,
  NEXT_PUBLIC_SUPABASE_URL: urlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: trimmedString,
  NEXT_PUBLIC_PRIVY_APP_ID: trimmedString,
  NEXT_PUBLIC_BASE_MAINNET_RPC_URL: urlSchema,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: urlSchema,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: trimmedString,
  NEXT_PUBLIC_PINATA_GATEWAY_URL: urlSchema.default('https://gateway.pinata.cloud'),
  NEXT_PUBLIC_SENTRY_DSN: urlSchema,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let _cachedClientEnv: ClientEnv | null = null;

export function parseClientEnv(
  rawEnvironment: NodeJS.ProcessEnv = {
    // NOTE: each variable MUST be read via direct `process.env.X` member
    // access (never a bare `process.env` reference). Next.js statically
    // inlines only member accesses into the browser bundle — a bare
    // reference ships the call as-is, throws at runtime (no NEXT_PUBLIC_*
    // values in the browser), and silently disables Privy. See providers.tsx
    // getPrivyConfigSafe() fallback. Server-side behavior is unchanged.
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL,
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_PINATA_GATEWAY_URL: process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  }
): ClientEnv {
  return parseEnvironment(clientEnvSchema, rawEnvironment, 'client');
}

export function getClientEnv(): ClientEnv {
  if (_cachedClientEnv === null) {
    _cachedClientEnv = parseClientEnv();
  }
  return _cachedClientEnv;
}

export function resetClientEnvCache(): void {
  _cachedClientEnv = null;
}
