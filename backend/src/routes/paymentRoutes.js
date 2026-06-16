import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/security.js';
import { asyncHandler, sendSuccess } from '../utils/response.js';
import { createDiscoveryOrder, verifyDiscoveryPayment, getDiscoveryFeeInr, isDiscoveryFeeEnabled } from '../services/paymentService.js';
import { trackEvent } from '../services/analyticsService.js';
import { validate } from '../validators/swapValidators.js';
import { z } from 'zod';

const router = Router();

const createOrderSchema = z.object({
  swapRequestId: z.string().uuid(),
});

const verifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
  swapRequestId: z.string().uuid(),
});

// GET /api/payments/config  — frontend reads this to know if payment is required
router.get('/config', asyncHandler(async (req, res) => {
  const [enabled, feeInr] = await Promise.all([isDiscoveryFeeEnabled(), getDiscoveryFeeInr()]);
  sendSuccess(res, { feeEnabled: enabled, feeInr });
}));

// POST /api/payments/discovery-order
router.post('/discovery-order',
  authenticate,
  strictRateLimiter,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const result = await createDiscoveryOrder(req.user.id, req.validatedBody.swapRequestId);
    await trackEvent(req.user.id, 'payment.initiated', { amount: result.amountInr }, req.analyticsContext);
    sendSuccess(res, result);
  })
);

// POST /api/payments/verify
router.post('/verify',
  authenticate,
  strictRateLimiter,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const result = await verifyDiscoveryPayment(req.user.id, req.validatedBody);
    await trackEvent(req.user.id, 'payment.completed', { orderId: req.validatedBody.orderId }, req.analyticsContext);
    sendSuccess(res, result);
  })
);

export default router;
