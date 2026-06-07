import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err } as any;
  error.message = err.message;
  error.stack = err.stack;

  // Log error stack trace internally
  logger.error(`${err.name}: ${err.message} \nStack: ${err.stack}`);

  // Map Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Invalid resource identifier`;
    error = new AppError(message, 400, 'BAD_REQUEST_ERROR');
  }

  // Map Mongoose Duplicate Key Error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const message = `Duplicate value for field: ${field}. Please use another value.`;
    error = new AppError(message, 409, 'CONFLICT_ERROR');
  }

  // Map Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((el: any) => ({
      field: el.path,
      message: el.message,
    }));
    error = new AppError('Database validation failed', 400, 'VALIDATION_ERROR');
    (error as any).errors = errors;
  }

  // Handle standard operational errors
  if (error.isOperational) {
    res.status(error.statusCode).json({
      status: 'error',
      code: error.code || 'APP_ERROR',
      message: error.message,
      ...(error.errors && { errors: error.errors }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
    return;
  }

  // Handle unexpected errors (e.g. system crashes, DB connection drops, coding errors)
  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    ...(process.env.NODE_ENV === 'development' && {
      originalMessage: err.message,
      stack: err.stack,
    }),
  });
};
