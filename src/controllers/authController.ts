import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  verifyRefreshToken,
} from '../utils/jwt';
import { UnauthorizedError } from '../utils/appError';
import { logger } from '../utils/logger';

// Mock DB or Cache to store OTP codes if we want to log what was "sent"
// For development, we always allow any 6-digit OTP, but we generate and log one for realism.
const otpCache = new Map<string, string>();

/**
 * @desc    Request SMS OTP code (Mocked)
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
export const sendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone } = req.body;

    // Generate a mock 6-digit OTP (e.g., 123456 or random)
    const generatedOtp = '123456'; 
    otpCache.set(phone, generatedOtp);

    // Securely log the generated code to backend console for validation
    logger.info(`[SMS MOCK] Generated OTP for user ${phone} is: ${generatedOtp}`);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully (Mocked)',
      // For developer ease, we also output it in dev environment response.
      ...(process.env.NODE_ENV !== 'production' && { dev_otp: generatedOtp }),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Verify SMS OTP code and log in/register
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    // The mock rule: literally ANY 6-digit OTP will be validated and accepted
    // (Zod schema has already checked that it is a 6-digit numeric string).
    logger.info(`[SMS MOCK] Verifying OTP ${otp} for phone ${phone}. Validated successfully.`);

    // Find or create user
    let user = await User.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        phone,
        tier: 'free',
        onboarding_profile: {
          avg_cycle_length: 28,
          avg_period_duration: 5,
          health_conditions: [],
          birth_control_type: 'none',
          health_goals: [],
          onboarding_completed: false,
          tracker_setup_completed: false,
        },
        notification_preferences: {
          period_reminder: true,
          daily_log_reminder: true,
          reminder_time: '09:00',
          insights_weekly: true,
        },
      });
      isNewUser = true;
      logger.info(`Registered new user with phone: ${phone}`);
    } else {
      // Update last active
      user.last_active = new Date();
      await user.save();
    }

    const payload = {
      userId: user._id.toString() as string,
      phone: user.phone,
      tier: user.tier,
    };

    // Generate tokens
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token in HttpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Authenticated successfully',
      data: {
        is_new_user: isNewUser,
        access_token: accessToken,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          age: user.age,
          avatar_url: user.avatar_url,
          tier: user.tier,
          onboarding_completed: user.onboarding_profile.onboarding_completed,
          tracker_setup_completed: user.onboarding_profile.tracker_setup_completed,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Refresh access token using refresh token in cookie
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies.refresh_token;

    if (!token) {
      return next(new UnauthorizedError('Refresh token is missing'));
    }

    let decodedPayload;
    try {
      decodedPayload = verifyRefreshToken(token);
    } catch (err) {
      return next(new UnauthorizedError('Refresh token is invalid or expired'));
    }

    // Check user exists
    const user = await User.findById(decodedPayload.userId);
    if (!user) {
      return next(new UnauthorizedError('User no longer exists'));
    }

    const newPayload = {
      userId: user._id.toString() as string,
      phone: user.phone,
      tier: user.tier,
    };

    const newAccessToken = generateAccessToken(newPayload);

    res.status(200).json({
      status: 'success',
      data: {
        access_token: newAccessToken,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Logout and invalidate tokens
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    clearRefreshTokenCookie(res);
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    return next(error);
  }
};
