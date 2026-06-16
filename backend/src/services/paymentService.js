/**
 * Discovery Fee Service
 * ---------------------
 * Controls whether a user must pay before seeing swap matches.
 * Config lives in app_config table so it can be toggled without redeploy.
 *
 * Flow:
 *  1. User creates swap request
 *  2. Before calling findMatches, frontend calls POST /api/payments/discovery-order
 *  3. We create a Razorpay order and return order_id + amount
 *  4. Frontend opens Razorpay checkout
 *  5. On payment success, frontend calls POST /api/payments/verify
 *  6. We verify signature, mark discovery_paid=true, unlock matches
 *
 * If discovery_fee_enabled=false or amount=0, we skip payment entirely.
 */

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';

// ── Load config from DB (cached 5 min) ───────────────────────────────────────
let configCache = null;
let configCachedAt = 0;
const CONFIG_TTL_MS = 5 * 60 * 1000;

export const getAppConfig = async () => {
  if (configCache && Date.now() - configCachedAt < CONFIG_TTL_MS) return configCache;

  const { data, error } = await supabaseAdmin
    .from('app_config')
    .select('key, value');

  if (error) throw new AppError('Failed to load app config', 500, 'CONFIG_ERROR');

  configCache = Object.fromEntries(data.map(r => [r.key, r.value]));
  configCachedAt = Date.now();
  return configCache;
};

export const invalidateConfigCache = () => { configCache = null; };

// ── Check if discovery is gated ───────────────────────────────────────────────
export const isDiscoveryFeeEnabled = async () => {
  const config = await getAppConfig();
  return config.discovery_fee_enabled === 'true' && Number(config.discovery_fee_inr) > 0;
};

export const getDiscoveryFeeInr = async () => {
  const config = await getAppConfig();
  return Number(config.discovery_fee_inr ?? 0);
};

// ── Create Razorpay order ─────────────────────────────────────────────────────
export const createDiscoveryOrder = async (userId, swapRequestId) => {
  const feeEnabled = await isDiscoveryFeeEnabled();
  if (!feeEnabled) {
    return { feeRequired: false };
  }

  // Check if already paid
  const { data: req } = await supabaseAdmin
    .from('swap_requests')
    .select('discovery_paid, discovery_order_id')
    .eq('id', swapRequestId)
    .eq('user_id', userId)
    .single();

  if (req?.discovery_paid) return { feeRequired: false, alreadyPaid: true };

  const amountInr = await getDiscoveryFeeInr();

  // Razorpay orders API — key_id and key_secret from env
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    logger.warn('Razorpay keys not configured — bypassing payment');
    return { feeRequired: false };
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: amountInr * 100, // paise
      currency: 'INR',
      receipt: `ss_${swapRequestId.slice(-8)}`,
      notes: { swap_request_id: swapRequestId, user_id: userId },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    logger.error('Razorpay order creation failed', { err });
    throw new AppError('Payment service unavailable', 503, 'PAYMENT_ERROR');
  }

  const order = await response.json();

  // Persist pending payment record
  await supabaseAdmin.from('discovery_payments').insert({
    user_id: userId,
    swap_request_id: swapRequestId,
    amount_inr: amountInr,
    provider: 'razorpay',
    order_id: order.id,
    status: 'pending',
  });

  await supabaseAdmin.from('swap_requests')
    .update({ discovery_order_id: order.id })
    .eq('id', swapRequestId);

  return {
    feeRequired: true,
    orderId: order.id,
    amountInr,
    keyId: RAZORPAY_KEY_ID,
  };
};

// ── Verify Razorpay payment signature ────────────────────────────────────────
export const verifyDiscoveryPayment = async (userId, { orderId, paymentId, signature, swapRequestId }) => {
  const { RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_SECRET) throw new AppError('Payment not configured', 503, 'PAYMENT_ERROR');

  const expectedSig = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSig !== signature) {
    logger.warn('Invalid Razorpay signature', { userId, orderId });
    throw new AppError('Payment verification failed', 400, 'PAYMENT_INVALID');
  }

  // Mark payment as paid
  await supabaseAdmin.from('discovery_payments')
    .update({ status: 'paid', payment_id: paymentId })
    .eq('order_id', orderId)
    .eq('user_id', userId);

  await supabaseAdmin.from('swap_requests')
    .update({ discovery_paid: true })
    .eq('id', swapRequestId)
    .eq('user_id', userId);

  return { verified: true };
};

// ── Assert payment before match discovery ────────────────────────────────────
export const assertDiscoveryAccess = async (userId, swapRequestId) => {
  const feeEnabled = await isDiscoveryFeeEnabled();
  if (!feeEnabled) return; // free mode — pass through

  const { data } = await supabaseAdmin
    .from('swap_requests')
    .select('discovery_paid')
    .eq('id', swapRequestId)
    .eq('user_id', userId)
    .single();

  if (!data?.discovery_paid) {
    throw new AppError(
      'Discovery fee required to view matches. Please complete payment first.',
      402,
      'PAYMENT_REQUIRED'
    );
  }
};
