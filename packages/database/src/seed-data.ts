/**
 * Deterministic seed records shared by `seed.ts` and the test suite.
 * UUIDs are fixed so RLS tests can impersonate users via
 * `request.jwt.claim.sub`. Wei values are decimal strings (numeric(78,0)).
 */

export const SEED_IDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  alice: '22222222-2222-4222-8222-222222222222',
  bob: '33333333-3333-4333-8333-333333333333',
  carol: '44444444-4444-4444-8444-444444444444',
  projectOpenScience: 'a0a0a0a0-0000-4000-8000-000000000001',
  projectDraft: 'a0a0a0a0-0000-4000-8000-000000000002',
  milestonePreprint: 'b0b0b0b0-0000-4000-8000-000000000001',
  milestoneDraft: 'b0b0b0b0-0000-4000-8000-000000000002',
  expensePublish: 'c0c0c0c0-0000-4000-8000-000000000001',
  reputationEvent: 'd0d0d0d0-0000-4000-8000-000000000001',
  agentRun: 'e0e0e0e0-0000-4000-8000-000000000001',
} as const;

export const SEED_WALLETS = {
  alice: '0xA11ce0000000000000000000000000000000001',
  bob: '0xB0b000000000000000000000000000000000002',
  admin: '0xAd000000000000000000000000000000000003',
} as const;
