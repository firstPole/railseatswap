import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Verifies the Supabase-issued JWT in the Authorization header.
 * Attaches the decoded user to req.user on success.
 * Rejects with 401 on missing/invalid/expired token.
 */
export const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing or malformed Authorization header', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);

    // ── Dev mock bypass ──────────────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development' && token === 'mock-development-token') {
      req.user = { id: '00000000-0000-0000-0000-000000000001', phone: '+919898989898' };
      return next();
    }

    if (process.env.NODE_ENV === 'development' && token === 'mock-development-token-2') {
  req.user = { id: '00000000-0000-0000-0000-000000000002', phone: '+919898989899' };
  return next();
}

const storeSession = useAuthStore.getState().session;
// Check if we're simulating party B
const isPartyB = new URLSearchParams(window.location.search).get('party') === 'B';
const mockToken = isPartyB ? 'mock-development-token-2' : 'mock-development-token';

if (storeSession?.access_token) {
  config.headers.Authorization = `Bearer ${storeSession.access_token}`;
} else {
  config.headers.Authorization = `Bearer ${mockToken}`;
}
    // ────────────────────────────────────────────────────────────────────────

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    req.user = { id: data.user.id, phone: data.user.phone, email: data.user.email };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Soft authentication — attaches user if token is present but does not
 * reject if no token is provided. Used for public + authenticated mixed routes.
 */
export const optionalAuthenticate = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data.user) {
      req.user = { id: data.user.id, phone: data.user.phone };
    }
  } catch {
    // Non-fatal — just proceed without user context
  }
  next();
};
