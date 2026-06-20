import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

// ── Helmet: sets secure HTTP headers ──────────────────────────────────────────
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", env.SUPABASE_URL],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ── CORS: only allow our known frontend origin ─────────────────────────────────
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173'];
const VERCEL_PREVIEW_REGEX = /^https:\/\/.*\.vercel\.app$/;

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Render health checks)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) || VERCEL_PREVIEW_REGEX.test(origin);

    if (!isAllowed) {
      return callback(new AppError('Not allowed by CORS', 403));
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
});


// ── Rate limiting: global default ─────────────────────────────────────────────
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
    });
  },
});

// ── Stricter limiter for auth + PNR lookup endpoints ──────────────────────────
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute.' },
    });
  },
});

// ── Strip dangerous keys from req.body recursively ────────────────────────────
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) {
      delete obj[key];
    } else {
      obj[key] = sanitizeObject(obj[key]);
    }
  }
  return obj;
}

export const sanitizeBody = (req, _res, next) => {
  if (req.body) sanitizeObject(req.body);
  next();
};
