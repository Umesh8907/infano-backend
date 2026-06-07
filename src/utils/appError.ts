export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors: any;

  constructor(message: string | any, errors?: any) {
    const msg = typeof message === 'string' ? message : 'Validation failed';
    const errs = typeof message === 'string' ? errors : message;
    super(msg, 400, 'VALIDATION_ERROR');
    this.errors = errs;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict occurred') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Something went wrong on the server') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
