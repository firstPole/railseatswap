// backend/src/services/pushService.js
import webpush from 'web-push';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';

webpush.setVapidDetails(
  'mailto:support@seatswap.in',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('push_subscription')
      .eq('id', userId)
      .single();

    if (!profile?.push_subscription) return;

    await webpush.sendNotification(
      profile.push_subscription,
      JSON.stringify({ title, body, data })
    );
  } catch (err) {
    logger.warn('Push notification failed', { userId, err: err.message });
  }
};