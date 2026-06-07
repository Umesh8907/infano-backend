import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const validateObjectId = (val: string) => objectIdRegex.test(val);

export const getJourneyDetailSchema = z.object({
  params: z.object({
    journeyId: z.string().refine(validateObjectId, { message: 'Invalid Journey ID parameter' }),
  }),
});

export const getEpisodeDetailSchema = z.object({
  params: z.object({
    episodeId: z.string().refine(validateObjectId, { message: 'Invalid Episode ID parameter' }),
  }),
});

export const getJourneyProgressSchema = z.object({
  params: z.object({
    journeyId: z.string().refine(validateObjectId, { message: 'Invalid Journey ID parameter' }),
  }),
});

export const startJourneySchema = z.object({
  body: z.object({
    journey_id: z
      .string({ required_error: 'Journey ID is required' })
      .refine(validateObjectId, { message: 'Invalid Journey ID format' }),
  }),
});

export const completeActivitySchema = z.object({
  body: z.object({
    episode_id: z
      .string({ required_error: 'Episode ID is required' })
      .refine(validateObjectId, { message: 'Invalid Episode ID format' }),
    activity_id: z
      .string({ required_error: 'Activity ID is required' })
      .refine(validateObjectId, { message: 'Invalid Activity ID format' }),
    response: z.any().optional(), // Can be string, number, array, or object depending on activity type
  }),
});
