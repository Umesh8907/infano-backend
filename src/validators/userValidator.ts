import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).optional(),
    age: z.number().min(10).max(100).optional(),
    onboarding_profile: z.object({
      last_period_date: z.string().datetime().optional(), // ISO string
      avg_cycle_length: z.number().min(15).max(60).optional(),
      avg_period_duration: z.number().min(1).max(14).optional(),
      health_conditions: z.array(z.string()).optional(),
      birth_control_type: z.string().optional(),
      health_goals: z.array(z.string()).optional(),
      onboarding_completed: z.boolean().optional(),
      tracker_setup_completed: z.boolean().optional(),
    }).optional(),
  }),
});
