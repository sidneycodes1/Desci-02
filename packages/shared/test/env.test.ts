import { describe, expect, it, beforeEach } from 'vitest';

import { parseClientEnv, resetClientEnvCache } from '../env/client';
import { parseServerEnv, resetServerEnvCache } from '../env/server';

const baseEnvironment = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://app.example.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  NEXT_PUBLIC_PRIVY_APP_ID: 'privy_app_example',
  NEXT_PUBLIC_BASE_MAINNET_RPC_URL: 'https://mainnet.base.org',
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'walletconnect_project_example',
  NEXT_PUBLIC_PINATA_GATEWAY_URL: 'https://gateway.pinata.cloud',
  NEXT_PUBLIC_SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example',
  PRIVY_APP_SECRET: 'privy_secret_example',
  REDIS_URL: 'redis://localhost:6379',
  PINATA_JWT: 'pinata_jwt_example',
  PINATA_GATEWAY_URL: 'https://gateway.pinata.cloud',
  OPENAI_API_KEY: 'openai_api_key_example',
  OPENAI_DEFAULT_MODEL: 'gpt-4.1-mini',
  OPENAI_REASONING_MODEL: 'gpt-4.1',
  GEMINI_API_KEY: 'gemini_api_key_example',
  GEMINI_DEFAULT_MODEL: 'gemini-2.0-flash',
  SENTRY_AUTH_TOKEN: 'sentry_auth_token_example',
  SENTRY_ORG: 'sentry_org_example',
  SENTRY_PROJECT: 'sentry_project_example',
} as const;

describe('environment validation', () => {
  beforeEach(() => {
    resetClientEnvCache();
    resetServerEnvCache();
  });
  it('parses the client environment contract', () => {
    const env = parseClientEnv(baseEnvironment);

    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://app.example.com');
    expect(env.NEXT_PUBLIC_PINATA_GATEWAY_URL).toBe('https://gateway.pinata.cloud');
  });

  it('parses the server environment contract', () => {
    const env = parseServerEnv(baseEnvironment);

    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.OPENAI_REASONING_MODEL).toBe('gpt-4.1');
  });

  it('fails fast when required variables are missing', () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: 'test',
      } as NodeJS.ProcessEnv)
    ).toThrow('[env] server validation failed');
  });
});
