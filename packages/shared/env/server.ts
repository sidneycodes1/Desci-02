import { z } from 'zod';

import { nodeEnvSchema, parseEnvironment, trimmedString, urlSchema } from './shared';

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_APP_URL: urlSchema,
  NEXT_PUBLIC_SUPABASE_URL: urlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: trimmedString,
  SUPABASE_SERVICE_ROLE_KEY: trimmedString,
  NEXT_PUBLIC_PRIVY_APP_ID: trimmedString,
  PRIVY_APP_SECRET: trimmedString,
  REDIS_URL: urlSchema,
  NEXT_PUBLIC_BASE_MAINNET_RPC_URL: urlSchema,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: urlSchema,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: trimmedString,
  PINATA_JWT: trimmedString,
  PINATA_GATEWAY_URL: urlSchema.default('https://gateway.pinata.cloud'),
  OPENAI_API_KEY: trimmedString,
  OPENAI_DEFAULT_MODEL: trimmedString.default('gpt-4.1-mini'),
  OPENAI_REASONING_MODEL: trimmedString.default('gpt-4.1'),
  GEMINI_API_KEY: trimmedString,
  GEMINI_DEFAULT_MODEL: trimmedString.default('gemini-2.0-flash'),
  NEXT_PUBLIC_SENTRY_DSN: urlSchema,
  SENTRY_AUTH_TOKEN: trimmedString.optional(),
  SENTRY_ORG: trimmedString.optional(),
  SENTRY_PROJECT: trimmedString.optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _cachedServerEnv: ServerEnv | null = null;

export function parseServerEnv(rawEnvironment: NodeJS.ProcessEnv = process.env): ServerEnv {
  return parseEnvironment(serverEnvSchema, rawEnvironment, 'server');
}

export function getServerEnv(): ServerEnv {
  if (_cachedServerEnv === null) {
    _cachedServerEnv = parseServerEnv();
  }
  return _cachedServerEnv;
}

export function resetServerEnvCache(): void {
  _cachedServerEnv = null;
}
