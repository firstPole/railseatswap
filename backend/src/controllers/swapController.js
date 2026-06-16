import { lookupPnr } from '../services/pnrService.js';
import { createSwapRequest, findMatches, confirmSwapChain } from '../services/swap/swapService.js';
import { generateTteSlip } from '../services/tteSlipService.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { NotFoundError, AppError } from '../utils/errors.js';

// POST /api/pnr/lookup
export const pnrLookup = async (req, res) => {
  const { pnr } = req.validatedBody;
  const data = await lookupPnr(pnr);
  sendSuccess(res, data);
};

// POST /api/swaps
export const createSwap = async (req, res) => {
  const { pnr, goal, preferredBerthType, nudge } = req.validatedBody;
  const pnrData = await lookupPnr(pnr);
  const swapRequest = await createSwapRequest(req.user.id, {
    pnrData,
    goal,
    preferredBerthType,
    nudge,
  });
  sendCreated(res, swapRequest);
};

// GET /api/swaps/:id/matches
export const getMatches = async (req, res) => {
  const { id } = req.params;
  const chains = await findMatches(id, req.user.id);
  sendSuccess(res, { chains, count: chains.length });
};

// GET /api/swaps  — list my active swap requests
export const listMySwaps = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('swap_requests')
    .select('*')
    .eq('user_id', req.user.id)
    .in('status', ['active', 'matched', 'completed'])
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Failed to load your swaps', 500, 'DB_ERROR');

  sendSuccess(res, data);
};

// DELETE /api/swaps/:id  — cancel a swap request
export const cancelSwap = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', req.user.id) // ownership enforced
    .in('status', ['active'])
    .select()
    .maybeSingle();

  if (error || !data) throw new NotFoundError('Swap request');

  sendSuccess(res, { message: 'Swap request cancelled.' });
};

// POST /api/swaps/sessions/:sessionId/confirm
export const confirmSwap = async (req, res) => {
  const { sessionId } = req.params;
  const result = await confirmSwapChain(sessionId, req.user.id);
  sendSuccess(res, result);
};

// GET /api/swaps/sessions/:sessionId/slip  — download TTE slip PDF
export const downloadTteSlip = async (req, res) => {
  const { sessionId } = req.params;

  const { data: session, error } = await supabaseAdmin
    .from('swap_sessions')
    .select('*, swap_session_parties(*, swap_request:swap_requests(*))')
    .eq('id', sessionId)
    .eq('status', 'completed')
    .maybeSingle();

  if (error || !session) throw new NotFoundError('Completed swap session');

  // Security: only participants may download the slip
  const isParticipant = session.swap_session_parties.some(p => p.user_id === req.user.id);
  if (!isParticipant) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  const pdfBuffer = await generateTteSlip(session);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="seatswap-slip-${sessionId.slice(-8)}.pdf"`,
    'Content-Length': pdfBuffer.length,
    'Cache-Control': 'no-store',
  });

  res.send(pdfBuffer);
};
