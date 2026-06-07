import { z } from 'zod';

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .regex(/^\+?[1-9]\d{1,14}$/, {
        message: 'Please provide a valid E.164 phone number format (e.g. +919876543210 or 919876543210)',
      }),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .regex(/^\+?[1-9]\d{1,14}$/, {
        message: 'Please provide a valid E.164 phone number format',
      }),
    otp: z
      .string({ required_error: 'OTP is required' })
      .length(6, { message: 'OTP must be exactly 6 digits' })
      .regex(/^\d+$/, { message: 'OTP must contain only digits' }),
  }),
});

export const refreshTokenSchema = z.object({
  // No body inputs required, read from HTTP cookies (or fallback body refresh_token)
  cookies: z.object({
    refresh_token: z.string({ required_error: 'Refresh token is required' }),
  }).optional(),
});
