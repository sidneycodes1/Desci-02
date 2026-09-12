import { describe, expect, it } from 'vitest';
import { userSettingsSchema, projectSettingsSchema } from '../settings';

describe('Settings Validation Schemas', () => {
  describe('userSettingsSchema', () => {
    it('validates a valid user profile settings input', () => {
      const result = userSettingsSchema.safeParse({
        displayName: 'Dr. Alice Researcher',
        bio: 'Genomics researcher working on open science.',
        orcidId: '0000-0002-1825-0097',
        primaryWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid ORCID ID format', () => {
      const result = userSettingsSchema.safeParse({
        displayName: 'Alice',
        orcidId: 'invalid-orcid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('projectSettingsSchema', () => {
    it('validates a valid project settings update payload', () => {
      const result = projectSettingsSchema.safeParse({
        name: 'Updated Quantum Project Title',
        metadataUri: 'https://ipfs.io/ipfs/QmUpdatedMetadataHash',
        status: 'active',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status state', () => {
      const result = projectSettingsSchema.safeParse({
        name: 'Project Title',
        metadataUri: 'https://ipfs.io/ipfs/QmHash',
        status: 'invalid_status_enum',
      });
      expect(result.success).toBe(false);
    });
  });
});
