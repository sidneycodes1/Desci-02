import { z } from 'zod';

/**
 * Phase 3 reader publishing (plan §07). Any authenticated wallet creates;
 * author + invited article collaborators edit; reading published is public.
 */
export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  subtitle: z.string().max(500).optional(),
  body: z.string().min(1, 'Body is required').max(100_000),
  projectId: z.string().uuid('Invalid project ID').optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  subtitle: z.string().max(500).optional(),
  body: z.string().min(1).max(100_000).optional(),
  projectId: z.string().uuid('Invalid project ID').nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

/** URL-safe slug from a title + short random suffix (collision-resistant). */
export function slugify(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 60) || 'article';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
