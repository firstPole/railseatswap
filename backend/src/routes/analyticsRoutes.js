import express from 'express';
import { trackEvent } from '../services/analyticsService.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { eventName, properties, userId } = req.body;
    
    // Grab the context automatically extracted by your analyticsContext middleware
    const context = req.analyticsContext || {};

    // Forward the data to your Supabase event tracker
    await trackEvent(userId || null, eventName, properties, context);

    // Send a happy 200 OK back to the frontend
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;