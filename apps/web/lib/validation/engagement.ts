import { z } from 'zod';

export const likeSchema = z.object({
  targetType: z.enum(['project', 'article']),
  targetId: z.string().uuid('Invalid target ID'),
});

export const createCommentSchema = z.object({
  targetType: z.enum(['project', 'article']),
  targetId: z.string().uuid('Invalid target ID'),
  body: z.string().min(1, 'Comment body required').max(2000, 'Comment too long (max 2000)'),
});

export type LikeInput = z.infer<typeof likeSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
