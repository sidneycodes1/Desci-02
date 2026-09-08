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

export function parseClientEnv(rawEnvironment: NodeJS.ProcessEnv = process.env): ClientEnv {
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
