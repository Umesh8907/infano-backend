import jwt from 'jsonwebtoken';
import { Response } from 'express';

export interface IJwtPayload {
  userId: string;
  phone: string;
  tier: 'free' | 'plus' | 'pro';
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

export const generateAccessToken = (payload: IJwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: IJwtPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });
};

export const verifyAccessToken = (token: string): IJwtPayload => {
  return jwt.verify(token, JWT_SECRET) as IJwtPayload;
};

export const verifyRefreshToken = (token: string): IJwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as IJwtPayload;
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};
