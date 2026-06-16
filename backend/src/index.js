import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { expireStaleRequests } from './services/swap/swapService.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`SeatSwap API running`, {
    port: env.PORT,
    env: env.NODE_ENV,
  });
});

// ── Periodic job: expire stale swap requests every 30 minutes ─────────────────
const EXPIRY_INTERVAL_MS = 30 * 60 * 1000;
const expiryJob = setInterval(async () => {
  try {
    await expireStaleRequests();
  } catch (err) {
    logger.error('Expiry job failed', { err });
  }
}, EXPIRY_INTERVAL_MS);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  clearInterval(expiryJob);
  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { err });
      process.exit(1);
    }
    logger.info('HTTP server closed. Bye.');
    process.exit(0);
  });

  // Force-kill after 10s if connections don't drain
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Unhandled rejection safety net ────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err });
  shutdown('uncaughtException');
});
