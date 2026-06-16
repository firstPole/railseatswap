import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

const PNR_REGEX = /^\d{10}$/;
const COACH_REGEX = /^[A-Z]{1,2}\d{1,2}$/i;

export const pnrLookupSchema = z.object({
  pnr: z
    .string({ required_error: 'PNR is required' })
    .regex(PNR_REGEX, 'PNR must be exactly 10 digits'),
});

export const createSwapRequestSchema = z.object({
  pnr: z.string().regex(PNR_REGEX, 'Invalid PNR'),
  goal: z.enum(['consolidate', 'berth_upgrade', 'open']).default('consolidate'),
  preferredBerthType: z.enum(['LB', 'MB', 'UB', 'SL', 'SU']).optional().nullable(),
  nudge: z.object({
    description: z.string().max(120).optional(),
  }).optional(),
});

export const confirmSwapSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

/**
 * Middleware factory: validates req.body against a Zod schema.
 * Calls next() on success, throws ValidationError on failure.
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Request validation failed', details));
  }
  req.validatedBody = result.data;
  next();
};

/**
 * Validates req.params against a schema.
 */
export const validateParams = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const details = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Invalid route parameters', details));
  }
  req.validatedParams = result.data;
  next();
};
