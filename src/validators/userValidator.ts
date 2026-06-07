import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).optional(),
    dob: z.string().datetime().optional(), // ISO String from frontend
    onboarding_profile: z.object({
      last_period_date: z.string().datetime().optional(),
      avg_cycle_length: z.number().min(15).max(60).optional(),
      avg_period_duration: z.number().min(1).max(14).optional(),
      health_conditions: z.array(z.string()).optional(),
      birth_control_type: z.string().optional(),
      health_goals: z.array(z.string()).optional(),
      typical_moods: z.array(z.string()).optional(),
      typical_symptoms: z.array(z.string()).optional(),
      onboarding_completed: z.boolean().optional(),
      tracker_setup_completed: z.boolean().optional(),
    }).optional(),
  }),
});
