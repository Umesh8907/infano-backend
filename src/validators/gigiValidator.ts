import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const validateObjectId = (val: string) => objectIdRegex.test(val);

export const postGigiMessageSchema = z.object({
  body: z.object({
    content: z
      .string({ required_error: 'Message content is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(1000, 'Message cannot exceed 1000 characters'),
    session_id: z
      .string()
      .refine(validateObjectId, { message: 'Invalid session ID format' })
      .optional(),
  }),
});

export const postGigiFeedbackSchema = z.object({
  params: z.object({
    messageId: z.string().refine(validateObjectId, { message: 'Invalid Message ID parameter' }),
  }),
  body: z.object({
    feedback: z.enum(['positive', 'negative'], {
      invalid_type_error: 'Feedback must be either positive or negative',
    }),
  }),
});

export const flagGigiMessageSchema = z.object({
  params: z.object({
    messageId: z.string().refine(validateObjectId, { message: 'Invalid Message ID parameter' }),
  }),
  body: z.object({
    reason: z
      .string({ required_error: 'Reason is required' })
      .trim()
      .min(1, 'Reason cannot be empty')
      .max(200, 'Reason cannot exceed 200 characters'),
  }),
});
