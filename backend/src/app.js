import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { helmetMiddleware, corsMiddleware, globalRateLimiter, sanitizeBody } from './middleware/security.js';
import { globalErrorHandler, notFoundHandler } from './utils/errors.js';
import swapRoutes from './routes/swapRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { analyticsContext } from './services/analyticsService.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

export const createApp = () => {
  const app = express();

  // ── Trust proxy (for correct IP behind Render/Railway reverse proxy) ─────────
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ── Core middleware ───────────────────────────────────────────────────────────
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '50kb' })); // small limit — no file uploads on this server
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(sanitizeBody);

  // ── Request logging ───────────────────────────────────────────────────────────
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );

  // ── Global rate limiter ───────────────────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── Health check (unauthenticated) ────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, ts: new Date().toISOString() });
  });

  // ── API routes ────────────────────────────────────────────────────────────────
  app.use(analyticsContext);
  app.use('/api', swapRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // ── 404 + global error handlers (must be last) ───────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};
