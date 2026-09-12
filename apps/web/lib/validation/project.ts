import { z } from 'zod';

export const projectStatusEnum = z.enum(['draft', 'active', 'completed', 'archived']);

export type ProjectStatus = z.infer<typeof projectStatusEnum>;

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name must be less than 200 characters'),
  metadataUri: z.string().url('Must be a valid URL').min(1, 'Metadata URI is required'),
  status: projectStatusEnum.default('draft'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name must be less than 200 characters').optional(),
  metadataUri: z.string().url('Must be a valid URL').min(1, 'Metadata URI is required').optional(),
  status: projectStatusEnum.optional(),
});

export const transitionProjectStatusSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  newStatus: projectStatusEnum,
});

export const addCollaboratorSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['owner', 'collaborator', 'viewer']).default('collaborator'),
});

export const removeCollaboratorSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type TransitionProjectStatusInput = z.infer<typeof transitionProjectStatusSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type RemoveCollaboratorInput = z.infer<typeof removeCollaboratorSchema>;
