import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError, ValidationError } from '../utils/errors.js';

const PNR_REGEX = /^\d{10}$/;

// ── Field mapper — update these keys after console.log(raw) with a real PNR ──
const mapPnrResponse = (raw) => {
  // TODO: once you get a real API response, verify these field names match
  // Run: console.log(JSON.stringify(raw, null, 2)) and update accordingly
  const passengers = (raw.passengerList ?? raw.Passengers ?? []).map((p, idx) => ({
    passengerIndex: idx + 1,
    coach: p.bookingCoach ?? p.BookingCoach ?? p.currentCoach ?? null,
    berth: p.bookingBerthNo ?? p.BookingBerth ?? p.currentBerthNo ?? null,
    berthType: normaliseBerthType(p.bookingBerthCode ?? p.BookingBerthCode ?? ''),
    bookingStatus: p.bookingStatus ?? p.BookingStatus ?? null,
    currentStatus: p.currentStatusCode ?? p.CurrentStatus ?? null,
    isConfirmed: isConfirmedStatus(p.currentStatusCode ?? p.CurrentStatus ?? ''),
  }));

  return {
    pnr: raw.pnrNumber ?? raw.PNRNumber,
    trainNumber: raw.trainNumber ?? raw.TrainNumber,
    trainName: raw.trainName ?? raw.TrainName,
    dateOfJourney: raw.dateOfJourney ?? raw.DateOfJourney,
    boardingStation: raw.boardingStationCode ?? raw.BoardingStationCode,
    destinationStation: raw.destinationStationCode ?? raw.DestinationStationCode,
    travelClass: raw.journeyClass ?? raw.Class,
    chartPrepared: raw.chartPrepared === 'Y' || raw.chartPrepared === true,
    passengers,
    maskedPnr: `XXXXXX${String(raw.pnrNumber ?? raw.PNRNumber).slice(-4)}`,
  };
};

const normaliseBerthType = (code) => {
  const map = { LB: 'Lower', MB: 'Middle', UB: 'Upper', SL: 'Side Lower', SU: 'Side Upper' };
  return map[code?.toUpperCase()] ?? code ?? '';
};

const isConfirmedStatus = (status) => {
  const s = (status ?? '').toUpperCase();
  return s.startsWith('CNF');
};

// ── Mock data (dev only) ──────────────────────────────────────────────────────
const MOCK_PNRS = {
  '1234567890': {
    pnrNumber: '1234567890', trainNumber: '12952', trainName: 'NIZAMUDDIN RAJDHANI',
    dateOfJourney: '2026-08-20', boardingStationCode: 'ADI', destinationStationCode: 'NDLS',
    journeyClass: '3A', chartPrepared: false,
    passengerList: [
      { bookingCoach: 'B1', bookingBerthNo: '22', bookingBerthCode: 'LB', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
      { bookingCoach: 'B1', bookingBerthNo: '24', bookingBerthCode: 'UB', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
       { bookingCoach: 'B5', bookingBerthNo: '45', bookingBerthCode: 'SU', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
      { bookingCoach: 'B5', bookingBerthNo: '46', bookingBerthCode: 'MB', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
    ],
  },
  '9876543210': {
    pnrNumber: '9876543210', trainNumber: '12952', trainName: 'NIZAMUDDIN RAJDHANI',
    dateOfJourney: '2026-08-20', boardingStationCode: 'ADI', destinationStationCode: 'NDLS',
    journeyClass: '3A', chartPrepared: false,
    passengerList: [
      { bookingCoach: 'B5', bookingBerthNo: '45', bookingBerthCode: 'SU', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
      { bookingCoach: 'B5', bookingBerthNo: '46', bookingBerthCode: 'MB', currentStatusCode: 'CNF', bookingStatus: 'CNF' },
    ],
  },
};

// ── Real API call ─────────────────────────────────────────────────────────────
const fetchFromApi = async (pnr) => {
  const response = await fetch(
    `${env.RAIL_API_BASE_URL}/checkPNRStatus/${pnr}`,
    { headers: { 'x-api-key': env.RAIL_API_KEY, 'accept': 'application/json' } }
  );

  if (response.status === 404) throw new AppError('PNR not found.', 404, 'PNR_NOT_FOUND');
  if (!response.ok) throw new AppError('Rail API error.', 503, 'UPSTREAM_ERROR');

  const raw = await response.json();
  logger.debug('Raw API response', { raw }); // TODO: remove after verifying field names
  return raw;
};

// ── Main export ───────────────────────────────────────────────────────────────
export const lookupPnr = async (pnr) => {
  if (!PNR_REGEX.test(pnr)) throw new ValidationError('PNR must be exactly 10 digits');

  logger.debug('PNR lookup', { pnr: `XXXXXX${pnr.slice(-4)}` });

  // Dev mock — controlled by env, not hardcoded PNR list in production
  if (env.MOCK_PNR === 'true') {
    const mockRaw = MOCK_PNRS[pnr];
    if (!mockRaw) throw new AppError('No mock data for this PNR. Try 9876543210 or 1234567890.', 404, 'PNR_NOT_FOUND');
    logger.info('[Mock] Returning mock PNR data', { pnr });
    const normalised = mapPnrResponse(mockRaw);
    return normalised;
  }

  let raw;
  try {
    raw = await fetchFromApi(pnr);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Rail API request failed', { message: err.message });
    throw new AppError('Unable to fetch PNR details right now.', 503, 'UPSTREAM_ERROR');
  }

  const normalised = mapPnrResponse(raw);

  if (!normalised.passengers.some(p => p.isConfirmed && p.berth)) {
    throw new AppError('No confirmed berths found. Seat swapping requires a confirmed reservation.', 422, 'NO_CONFIRMED_BERTH');
  }

  return normalised;
};