import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// ── Custom error class ─────────────────────────────────────────────────────────
export class AppError extends Error {
  /**
   * @param {string} message   - Human-readable message (safe to expose to client)
   * @param {number} statusCode
   * @param {string} code      - Machine-readable error code
   * @param {object} details   - Optional extra context (NOT exposed in production)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ── Global error handler ───────────────────────────────────────────────────────
// Must be registered LAST in the Express middleware chain (4 params).
export const globalErrorHandler = (err, req, res, _next) => {
  // Determine if this is an expected operational error or an unexpected crash
  const isOperational = err.isOperational === true;
  const statusCode = err.statusCode ?? 500;

  if (!isOperational) {
    // Unexpected bug — log full stack, alert on-call in production
    logger.error('Unexpected error (non-operational)', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id ?? 'anonymous',
    });
  } else {
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      statusCode,
      path: req.path,
    });
  }

  // Never leak stack traces or internal details to the client in production
  const responseBody = {
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: isOperational
        ? err.message
        : 'An unexpected error occurred. Please try again.',
      ...(env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details,
      }),
    },
  };

  res.status(statusCode).json(responseBody);
};

// ── 404 handler for unknown routes ────────────────────────────────────────────
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} does not exist`,
    },
  });
};
