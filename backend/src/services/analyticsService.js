/**
 * Analytics Service
 * -----------------
 * Every significant user action is recorded here.
 * This data is the product's core asset for enterprise sale.
 *
 * Event taxonomy:
 *   auth.*          — signup, login, logout
 *   pnr.*           — lookup, validated, failed
 *   swap.*          — created, match_viewed, chain_viewed, confirmed, cancelled
 *   payment.*       — initiated, completed, failed
 *   discovery.*     — chart_drop_opened, flash_mode_activated
 *   nudge.*         — added, accepted
 *
 * Captured per event: user_id, train_number, journey_date, device_type,
 * app_version, source — enough to build cohort/funnel analysis.
 */

import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';

/**
 * @param {string|null} userId
 * @param {string} eventName
 * @param {object} properties
 * @param {object} context   - { deviceType, appVersion, sessionId, source }
 */
export const trackEvent = async (userId, eventName, properties = {}, context = {}) => {
  try {
    await supabaseAdmin.from('analytics_events').insert({
      user_id: userId ?? null,
      event_name: eventName,
      properties,
      session_id: context.sessionId ?? null,
      device_type: context.deviceType ?? null,
      app_version: context.appVersion ?? null,
    });
  } catch (err) {
    // Analytics must never crash the main flow
    logger.warn('Analytics event failed silently', { eventName, err: err.message });
  }
};

/**
 * Express middleware — extracts device/version context from headers
 * and attaches it to req.analyticsContext for use in controllers.
 */
export const analyticsContext = (req, _res, next) => {
  req.analyticsContext = {
    deviceType: req.headers['x-device-type'] ?? 'unknown',
    appVersion: req.headers['x-app-version'] ?? 'unknown',
    sessionId: req.headers['x-session-id'] ?? null,
    source: req.headers['x-source'] ?? 'direct',
  };
  next();
};
