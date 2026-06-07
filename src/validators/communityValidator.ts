import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const validateObjectId = (val: string) => objectIdRegex.test(val);

export const createPostSchema = z.object({
  body: z.object({
    space_id: z.string({ required_error: 'Space ID is required' }).refine(validateObjectId, {
      message: 'Invalid Space ID format',
    }),
    type: z.enum(['text_post', 'question', 'poll', 'story'], {
      invalid_type_error: 'Post type must be text_post, question, poll, or story',
    }),
    title: z.string().trim().max(100, 'Title cannot exceed 100 characters').optional(),
    body: z
      .string({ required_error: 'Post body is required' })
      .trim()
      .min(1, 'Body cannot be empty')
      .max(1500, 'Body cannot exceed 1500 characters'),
    is_anonymous: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    poll_options: z
      .array(
        z.object({
          option_text: z
            .string({ required_error: 'Option text is required' })
            .trim()
            .min(1, 'Option text cannot be empty')
            .max(80, 'Option text cannot exceed 80 characters'),
        })
      )
      .min(2, 'A poll requires at least 2 options')
      .max(4, 'A poll cannot have more than 4 options')
      .optional(),
    media_url: z.string().url('Invalid media URL format').optional().or(z.literal('')),
  }),
});

export const updatePostSchema = z.object({
  params: z.object({
    postId: z.string().refine(validateObjectId, { message: 'Invalid Post ID parameter' }),
  }),
  body: z.object({
    title: z.string().trim().max(100).optional(),
    body: z.string().trim().min(1, 'Body cannot be empty').max(1500),
  }),
});

export const createCommentSchema = z.object({
  params: z.object({
    postId: z.string().refine(validateObjectId, { message: 'Invalid Post ID parameter' }),
  }),
  body: z.object({
    body: z
      .string({ required_error: 'Comment body is required' })
      .trim()
      .min(1, 'Comment cannot be empty')
      .max(500, 'Comment cannot exceed 500 characters'),
    parent_comment_id: z
      .string()
      .refine(validateObjectId, { message: 'Invalid parent comment ID format' })
      .optional()
      .nullable(),
    is_anonymous: z.boolean().optional(),
  }),
});

export const reactSchema = z.object({
  body: z.object({
    reaction_type: z.enum(['heart', 'support', 'relate', 'informative'], {
      invalid_type_error: 'Reaction type must be heart, support, relate, or informative',
    }),
  }),
});

export const flagSchema = z.object({
  body: z.object({
    reason: z
      .string({ required_error: 'Flag reason is required' })
      .trim()
      .min(1, 'Reason cannot be empty')
      .max(200, 'Reason cannot exceed 200 characters'),
  }),
});

export const pollVoteSchema = z.object({
  body: z.object({
    option_index: z
      .number({ required_error: 'Option index is required' })
      .int()
      .min(0, 'Option index must be 0 or greater'),
  }),
});
