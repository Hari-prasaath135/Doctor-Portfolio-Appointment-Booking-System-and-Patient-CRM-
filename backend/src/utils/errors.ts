/**
 * Base application error class.
 * All custom errors extend this so they can be caught and handled uniformly
 * in the Express global error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Restore the prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/** 400 – malformed or invalid request */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, 400);
    this.fields = fields;
  }
}

/** 400 – bad request */
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

/** 401 – token missing or invalid */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/** 403 – authenticated but insufficient permissions */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}

/** 404 – resource not found */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/** 409 – conflict (e.g., double-booking, duplicate entry) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** 422 – request understood but cannot be processed (business-logic rejection) */
export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

/** 503 – upstream service (Pinelabs, Zoom, Firebase) temporarily unavailable */
export class ServiceUnavailableError extends AppError {
  constructor(service = 'External service') {
    super(`${service} is currently unavailable. Please try again later.`, 503);
  }
}
