import { apiClient } from '../lib/apiClient.js';

// Fire-and-forget; never throws
export const track = async (eventName, properties = {}) => {
  try {
    await apiClient.post('/analytics', { eventName, properties });
  } catch {
    // Silently ignored — analytics must never affect UX
  }
};

// Convenience event builders
export const Analytics = {
  pnrLookup: (trainNumber) => track('pnr.lookup', { trainNumber }),
  swapCreated: (trainNumber, seatCount) => track('swap.created', { trainNumber, seatCount }),
  matchViewed: (chainType, fitScore) => track('swap.match_viewed', { chainType, fitScore }),
  paymentInitiated: (amountInr) => track('payment.initiated', { amountInr }),
  paymentCompleted: () => track('payment.completed'),
  swapConfirmed: (chainType) => track('swap.confirmed', { chainType }),
  chartDropOpened: (trainNumber) => track('discovery.chart_drop_opened', { trainNumber }),
};
