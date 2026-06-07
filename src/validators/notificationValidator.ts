import { z } from 'zod';

export const registerDeviceSchema = z.object({
  body: z.object({
    device_token: z
      .string({ required_error: 'Device token is required' })
      .trim()
      .min(1, 'Device token cannot be empty'),
    platform: z.enum(['ios', 'android'], {
      invalid_type_error: 'Platform must be either ios or android',
    }),
  }),
});

export const deregisterDeviceSchema = z.object({
  params: z.object({
    token: z
      .string({ required_error: 'Device token parameter is required' })
      .trim()
      .min(1, 'Device token cannot be empty'),
  }),
});
