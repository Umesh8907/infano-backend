import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/appError';

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new UnauthorizedError('Please log in to access this resource'));
    }

    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      return next();
    } catch (err) {
      return next(new UnauthorizedError('Token is invalid or has expired'));
    }
  } catch (error) {
    return next(error);
  }
};

export const restrictTo = (...allowedTiers: ('free' | 'plus' | 'pro')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedTiers.includes(req.user.tier)) {
      return next(new ForbiddenError('You do not have permission to perform this action (requires upgrade)'));
    }

    return next();
  };
};
