import { z } from 'zod';

export const createLogSchema = z.object({
  body: z.object({
    date: z
      .string({ required_error: 'Date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
    period_started: z.boolean().optional(),
    period_ended: z.boolean().optional(),
    flow: z
      .enum(['none', 'spotting', 'light', 'medium', 'heavy'], {
        invalid_type_error: 'Flow must be none, spotting, light, medium, or heavy',
      })
      .optional(),
    mood: z.array(z.string()).optional(),
    energy_level: z
      .number()
      .min(1, 'Energy level must be at least 1')
      .max(5, 'Energy level cannot exceed 5')
      .optional(),
    sleep_hours: z
      .number()
      .min(0, 'Sleep hours cannot be negative')
      .max(24, 'Sleep hours cannot exceed 24')
      .optional(),
    symptoms: z.array(z.string()).optional(),
    water_intake_cups: z.number().min(0).optional(),
    exercise_minutes: z.number().min(0).optional(),
    weight_kg: z.number().min(0).optional(),
    notes: z.string().optional(),
  }),
});

export const getLogsSchema = z.object({
  query: z.object({
    from: z
      .string({ required_error: 'From date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'From date must be in YYYY-MM-DD format' }),
    to: z
      .string({ required_error: 'To date is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'To date must be in YYYY-MM-DD format' }),
  }),
});

export const getLogByDateSchema = z.object({
  params: z.object({
    date: z
      .string({ required_error: 'Date param is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date parameter must be in YYYY-MM-DD format' }),
  }),
});
