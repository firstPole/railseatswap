import { supabaseAdmin } from '../../config/supabase.js';
import { logger } from '../../config/logger.js';
import { AppError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { findSwapChains } from './chainSwapEngine.js';
import { sendPushToUser } from '../pushService.js';

// ── Helper: determine offered (stranded) seats ────────────────────────────────
const getOfferedSeats = (seats, targetCoach) => {
  const stranded = seats.filter(s => s.coach !== targetCoach);
  // If all seats already in target coach — offer nothing (no swap needed)
  // If split — offer only stranded seats
  return stranded.length > 0 ? stranded : [];
};

// ── Helper: auto-pick target coach (most seats) ───────────────────────────────
const pickTargetCoach = (seats) => {
  const counts = {};
  seats.forEach(s => { counts[s.coach] = (counts[s.coach] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
};

export const createSwapRequest = async (userId, payload) => {
  const { pnrData, goal, preferredBerthType, nudge } = payload;

  const seats = pnrData.passengers
    .filter(p => p.isConfirmed && p.berth)
    .map(p => ({ coach: p.coach, berth: Number(p.berth), berthType: p.berthType }));

  if (!seats.length) throw new AppError('No confirmed seats found.', 422, 'NO_CONFIRMED_BERTH');

  const targetCoach = pickTargetCoach(seats);
  const offeredSeats = getOfferedSeats(seats, targetCoach);

  // Already together — no swap needed
  if (offeredSeats.length === 0 && goal === 'consolidate') {
    throw new AppError('All seats are already in the same coach. No swap needed!', 422, 'ALREADY_TOGETHER');
  }

  // For open/berth_upgrade goals, offer all seats
  const effectiveOffered = offeredSeats.length > 0 ? offeredSeats : seats;

  logger.debug('Creating swap request', {
    userId, targetCoach,
    allSeats: seats.length,
    offeredSeats: effectiveOffered.length,
    goal,
  });

  const { data: swapId, error } = await supabaseAdmin.rpc('create_swap_request_direct', {
    p_user_id: userId,
    p_pnr: pnrData.pnr,
    p_masked_pnr: pnrData.maskedPnr,
    p_train_number: pnrData.trainNumber,
    p_train_name: pnrData.trainName ?? '',
    p_journey_date: pnrData.dateOfJourney,
    p_travel_class: pnrData.travelClass ?? '3A',
    p_boarding_station: pnrData.boardingStation ?? '',
    p_destination_station: pnrData.destinationStation ?? '',
    p_chart_prepared: pnrData.chartPrepared ?? false,
    p_current_coaches: seats.map(s => s.coach),
    p_current_berths: seats.map(s => s.berth),
    p_berth_types: seats.map(s => s.berthType),
    p_seat_count: seats.length,
    p_target_coach: targetCoach,
    p_has_nudge: !!nudge?.description,
    p_nudge_description: nudge?.description ?? null,
  });

  if (error) {
    if (error.message?.includes('DUPLICATE_PNR')) throw new ConflictError('An active swap request already exists for this PNR.');
    logger.error('RPC failed', { error: error.message, code: error.code });
    throw new AppError('Failed to create swap request', 500, 'DB_ERROR');
  }

  // Store offered seats + goal separately
  await supabaseAdmin.from('swap_requests').update({
    offered_coaches: effectiveOffered.map(s => s.coach),
    offered_berths: effectiveOffered.map(s => s.berth),
    offered_berth_types: effectiveOffered.map(s => s.berthType),
    offered_seat_count: effectiveOffered.length,
    goal: goal ?? 'consolidate',
    preferred_berth_type: preferredBerthType ?? null,
  }).eq('id', swapId);

  const { data: record } = await supabaseAdmin
    .from('swap_requests').select('*').eq('id', swapId).single();

  return record ?? { id: swapId, status: 'active', target_coach: targetCoach };
};

export const findMatches = async (swapRequestId, requestingUserId) => {
  const { data: req, error: reqError } = await supabaseAdmin
    .from('swap_requests').select('*')
    .eq('id', swapRequestId).eq('user_id', requestingUserId)
    .eq('status', 'active').maybeSingle();

  if (reqError || !req) throw new NotFoundError('Swap request');

  const { data: candidates } = await supabaseAdmin
    .from('swap_requests').select('*')
    .eq('train_number', req.train_number)
    .eq('journey_date', req.journey_date)
    .eq('status', 'active')
    .neq('user_id', requestingUserId)
    .gt('expires_at', new Date().toISOString());

  const toEngine = (row) => ({
    id: row.id,
    userId: row.user_id,
    trainNumber: row.train_number,
    journeyDate: row.journey_date,
    currentCoaches: row.current_coaches,
    currentBerths: row.current_berths,
    berthTypes: row.berth_types,
    // Use offered fields if available, fall back to current
    offeredCoaches: row.offered_coaches ?? row.current_coaches,
    offeredBerths: row.offered_berths ?? row.current_berths,
    offeredBerthTypes: row.offered_berth_types ?? row.berth_types,
    offeredSeatCount: row.offered_seat_count ?? row.seat_count,
    targetCoach: row.target_coach,
    seatCount: row.seat_count,
    goal: row.goal ?? 'consolidate',
    preferredBerthType: row.preferred_berth_type ?? null,
    hasNudge: row.has_nudge,
    nudgeDescription: row.nudge_description,
  });

  const chains = findSwapChains(toEngine(req), (candidates ?? []).map(toEngine));

  // ── Push notification if new matches found ────────────────────
  if (chains.length > 0) {
    sendPushToUser(
      requestingUserId,
      '🎯 Match found on your train!',
      'Someone can swap seats with your family. Open SeatSwap now.',
      { swapId: swapRequestId }
    ).catch(() => {}); // fire and forget
  }
  // ─────────────────────────────────────────────────────────────

  

  return chains.map(chain => ({
    ...chain,
    parties: chain.parties.map(p => {
      const row = [req, ...(candidates ?? [])].find(r => r.id === p.id);
      return { ...p, pnr: undefined, maskedPnr: row?.masked_pnr };
    }),
  }));
};

export const expireStaleRequests = async () => {
  const { error } = await supabaseAdmin.from('swap_requests')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());
  if (error) logger.error('Failed to expire stale requests', { error });
};
export const confirmSwapChain = async (chainSessionId, userId) => {
  const { data: session, error } = await supabaseAdmin
    .from('swap_sessions')
    .select('*, swap_session_parties(*)')
    .eq('id', chainSessionId)
    .maybeSingle();

  if (error || !session) throw new NotFoundError('Swap session');
  if (session.status === 'completed') throw new ConflictError('Already confirmed.');
  if (new Date(session.expires_at) < new Date()) {
    throw new AppError('Swap session expired.', 410, 'SESSION_EXPIRED');
  }

  const party = session.swap_session_parties.find(p => p.user_id === userId);
  if (!party) throw new AppError('Not a participant.', 403, 'FORBIDDEN');
  if (party.confirmed) throw new ConflictError('Already confirmed.');

  await supabaseAdmin.from('swap_session_parties')
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq('id', party.id);

  const { data: updated } = await supabaseAdmin
    .from('swap_session_parties').select('confirmed').eq('session_id', chainSessionId);

  const allConfirmed = updated?.every(p => p.confirmed);

  if (allConfirmed) {
    await supabaseAdmin.from('swap_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', chainSessionId);
    await supabaseAdmin.from('swap_requests')
      .update({ status: 'completed' })
      .in('id', session.swap_session_parties.map(p => p.swap_request_id));
    return { status: 'completed', allConfirmed: true };
  }

  return {
    status: 'pending', allConfirmed: false,
    confirmedCount: updated?.filter(p => p.confirmed).length ?? 0,
    totalCount: updated?.length ?? 0,
  };
};