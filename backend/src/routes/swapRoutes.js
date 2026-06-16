import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/security.js';
import { validate, validateParams, pnrLookupSchema, createSwapRequestSchema } from '../validators/swapValidators.js';
import { asyncHandler } from '../utils/response.js';
import { sendSuccess } from '../utils/response.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendPushToUser } from '../services/pushService.js';
import { logger } from '../config/logger.js';
import {
  pnrLookup,
  createSwap,
  getMatches,
  listMySwaps,
  cancelSwap,
  confirmSwap,
  downloadTteSlip,
} from '../controllers/swapController.js';
import { z } from 'zod';

const router = Router();
const uuidParamSchema = z.object({ id: z.string().uuid() });
const sessionParamSchema = z.object({ sessionId: z.string().uuid() });

// ── PNR lookup (auth required so we can rate-limit per user, not just IP) ──────
router.post(
  '/pnr/lookup',
  authenticate,
  strictRateLimiter,
  validate(pnrLookupSchema),
  asyncHandler(pnrLookup)
);

// ── Swap requests ─────────────────────────────────────────────────────────────
router.get('/swaps', authenticate, asyncHandler(listMySwaps));

router.post(
  '/swaps',
  authenticate,
  strictRateLimiter,
  validate(createSwapRequestSchema),
  asyncHandler(createSwap)
);

router.delete(
  '/swaps/:id',
  authenticate,
  validateParams(uuidParamSchema),
  asyncHandler(cancelSwap)
);

router.get(
  '/swaps/:id/matches',
  authenticate,
  validateParams(uuidParamSchema),
  asyncHandler(getMatches)
);

// ── Swap sessions (confirmation) ──────────────────────────────────────────────
router.post(
  '/swaps/sessions/:sessionId/confirm',
  authenticate,
  validateParams(sessionParamSchema),
  asyncHandler(confirmSwap)
);

router.get(
  '/swaps/sessions/:sessionId/slip',
  authenticate,
  validateParams(sessionParamSchema),
  asyncHandler(downloadTteSlip)
);
router.post('/matches/signal',
  authenticate,
  asyncHandler(async (req, res) => {
    const { 
      matchId, swapRequestId,
      yourNewCoaches, yourNewBerths,
      yourGiveCoaches, yourGiveBerths,
      trainNumber, trainName, journeyDate,
      shortCode,
    } = req.body ?? {};

    if (swapRequestId) {
      await supabaseAdmin.from('signals').insert({
        from_user_id: req.user.id,
        swap_request_id: swapRequestId,
        match_id: matchId ?? null,
        your_new_coaches: yourNewCoaches ?? [],
        your_new_berths: yourNewBerths ?? [],
        your_give_coaches: yourGiveCoaches ?? [],
        your_give_berths: yourGiveBerths ?? [],
        train_number: trainNumber ?? null,
        train_name: trainName ?? null,
        journey_date: journeyDate ?? null,
        short_code: shortCode ?? null,
        status: 'pending',
      });
      // ── Push notification to Party A ──────────────────────────
      const { data: targetSwap } = await supabaseAdmin
        .from('swap_requests')
        .select('user_id')
        .eq('id', swapRequestId)
        .single();

      if (targetSwap?.user_id) {
        await sendPushToUser(
          targetSwap.user_id,
          '🔔 Someone wants to swap with you!',
          'Open SeatSwap to accept or decline',
          { swapId: swapRequestId }
        );
      }
      // ─────────────────────────────────────────────────────────
    }
    sendSuccess(res, { signalled: true });  // ← already exists
    
  })
);



router.post('/push/subscribe', authenticate, asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  await supabaseAdmin.from('user_profiles')
    .update({ push_subscription: subscription })
    .eq('id', req.user.id);
  sendSuccess(res, { subscribed: true });
}));

router.post('/matches/signal/accept', authenticate, asyncHandler(async (req, res) => {
  const { signalId } = req.body ?? {};
  await supabaseAdmin.from('signals')
    .update({ status: 'accepted' })
    .eq('id', signalId);
  // Notify original party via Realtime by updating signals table
 await supabaseAdmin.from('signals')
    .update({ status: 'accepted' })
    .eq('id', signalId);

  // ── Push notification to Party B (who sent the signal) ───────
  const { data: signal } = await supabaseAdmin
    .from('signals')
    .select('from_user_id, swap_request_id')
    .eq('id', signalId)
    .single();

  if (signal?.from_user_id) {
    await sendPushToUser(
      signal.from_user_id,
      '✅ Swap accepted!',
      'The other passenger agreed. Open app for details.',
      { swapId: signal.swap_request_id }
    );
  }
  // ─────────────────────────────────────────────────────────────

  sendSuccess(res, { accepted: true });  // ← already exists
}));

router.post('/matches/signal/decline', authenticate, asyncHandler(async (req, res) => {
  const { signalId } = req.body ?? {};
  await supabaseAdmin.from('signals')
    .update({ status: 'declined' })
    .eq('id', signalId);
  sendSuccess(res, { declined: true });
}));

export default router;
