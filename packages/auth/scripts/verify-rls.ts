#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RLS_FILE = process.env.RLS_FILE ?? 'packages/auth/src/rls.ts';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  if (!existsSync(RLS_FILE)) {
    console.error(`RLS file not found: ${RLS_FILE}`);
    process.exit(1);
  }

  const sql = readFileSync(RLS_FILE, 'utf-8');
  console.log(`RLS SQL ready for deployment to ${SUPABASE_URL}`);
  console.log(`Policy count: ${(sql.match(/CREATE POLICY/g) ?? []).length}`);
  console.log('\nRun the following in Supabase SQL Editor:\n');
  console.log(sql);
}

main().catch(console.error);
