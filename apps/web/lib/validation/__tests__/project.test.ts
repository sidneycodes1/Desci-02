import { describe, expect, it } from 'vitest';

import {
  createProjectSchema,
  updateProjectSchema,
  transitionProjectStatusSchema,
  addCollaboratorSchema,
  removeCollaboratorSchema,
} from '../project';

describe('Project validation schemas', () => {
  describe('createProjectSchema', () => {
    it('accepts valid project data', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
        metadataUri: 'https://example.com/metadata.json',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      const result = createProjectSchema.safeParse({
        metadataUri: 'https://example.com/metadata.json',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createProjectSchema.safeParse({
        name: '',
        metadataUri: 'https://example.com/metadata.json',
      });
      expect(result.success).toBe(false);
    });

    it('rejects name too long', () => {
      const result = createProjectSchema.safeParse({
        name: 'a'.repeat(201),
        metadataUri: 'https://example.com/metadata.json',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid URL', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
        metadataUri: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid status', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
        metadataUri: 'https://example.com/metadata.json',
        status: 'active',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
        metadataUri: 'https://example.com/metadata.json',
        status: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProjectSchema', () => {
    it('accepts partial updates', () => {
      const result = updateProjectSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates name when provided', () => {
      const result = updateProjectSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('validates metadataUri when provided', () => {
      const result = updateProjectSchema.safeParse({
        metadataUri: 'invalid-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('transitionProjectStatusSchema', () => {
    it('accepts valid transition data', () => {
      const result = transitionProjectStatusSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        newStatus: 'active',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid project ID', () => {
      const result = transitionProjectStatusSchema.safeParse({
        projectId: 'not-a-uuid',
        newStatus: 'active',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid status', () => {
      const result = transitionProjectStatusSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        newStatus: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addCollaboratorSchema', () => {
    it('accepts valid collaborator data', () => {
      const result = addCollaboratorSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        role: 'collaborator',
      });
      expect(result.success).toBe(true);
    });

    it('defaults role to collaborator', () => {
      const result = addCollaboratorSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('collaborator');
      }
    });

    it('rejects invalid role', () => {
      const result = addCollaboratorSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        role: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('removeCollaboratorSchema', () => {
    it('accepts valid removal data', () => {
      const result = removeCollaboratorSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid project ID', () => {
      const result = removeCollaboratorSchema.safeParse({
        projectId: 'not-a-uuid',
        userId: '123e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid user ID', () => {
      const result = removeCollaboratorSchema.safeParse({
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
