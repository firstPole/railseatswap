/**
 * Chain-Swap Engine v3 — Coverage-based model
 * --------------------------------------------
 * Core idea:
 *   A family declares their stranded seats (what they'll vacate)
 *   and their target coach (where they want to go).
 *
 *   The engine finds ANY combination of other passengers who:
 *   a) Have seats available in the target coach (can fill family's need)
 *   b) Are willing to move (they have an active swap request)
 *
 *   Seat counts don't need to match exactly.
 *   1 person giving 2 seats OR 2 people each giving 1 seat = same result.
 *
 *   The family's vacated seats are distributed to whoever is moving out.
 *   Everyone wins — family sits together, others get seats too.
 *
 * Algorithm:
 *   1. Identify what the requesting family NEEDS: N seats in coach X
 *   2. Find all candidate seats available in coach X across all requests
 *   3. Find combinations that cover N seats (greedy, best-fit first)
 *   4. Build swap proposals showing exactly who moves where
 */

import { logger } from '../../config/logger.js';

const BERTH_QUALITY = { LB: 5, SL: 4, MB: 3, UB: 2, SU: 1 };
const berthQuality = (t) => BERTH_QUALITY[t?.toUpperCase()] ?? 0;

/**
 * Find all swap proposals for a requesting party.
 *
 * @param {object} requestingParty  - the family/group seeking consolidation
 * @param {object[]} candidates     - all other active swap requests on same train
 * @returns {object[]}              - ranked swap proposals
 */
export const findSwapChains = (requestingParty, candidateParties) => {
  logger.debug('Chain-swap engine v3 running', {
    requestingParty: requestingParty.id,
    targetCoach: requestingParty.targetCoach,
    strandedSeats: requestingParty.offeredSeatCount,
    candidates: candidateParties.length,
  });

  // Filter same train + date
  const eligible = candidateParties.filter(p =>
    p.trainNumber === requestingParty.trainNumber &&
    p.journeyDate === requestingParty.journeyDate &&
    p.id !== requestingParty.id
  );

  if (!eligible.length) return [];

  const targetCoach = requestingParty.targetCoach;
  const seatsNeeded = requestingParty.offeredSeatCount; // stranded seats to replace

  // ── Build pool of available seats in target coach ─────────────────────────
  // Each candidate who HAS seats in target coach is a potential contributor
  const seatPool = [];
  eligible.forEach(candidate => {
    const seatsInTarget = (candidate.currentCoaches ?? [])
      .map((coach, i) => ({ coach, berth: candidate.currentBerths?.[i], berthType: candidate.berthTypes?.[i], candidateId: candidate.id }))
      .filter(s => s.coach === targetCoach);

    if (seatsInTarget.length > 0) {
      seatPool.push({
        candidate,
        availableSeats: seatsInTarget,
        count: seatsInTarget.length,
        avgQuality: seatsInTarget.reduce((s, b) => s + berthQuality(b.berthType), 0) / seatsInTarget.length,
      });
    }
  });

  logger.debug('Seat pool in target coach', {
    targetCoach,
    seatsNeeded,
    poolSize: seatPool.reduce((s, p) => s + p.count, 0),
    contributors: seatPool.length,
  });

  if (seatPool.length === 0) return [];

  // ── Sort pool by berth quality descending (offer best seats first) ────────
  seatPool.sort((a, b) => b.avgQuality - a.avgQuality);

  const proposals = [];

  // ── Strategy 1: Single party covers all needed seats ─────────────────────
  seatPool.forEach(contributor => {
    if (contributor.count >= seatsNeeded) {
      const seatsToUse = contributor.availableSeats.slice(0, seatsNeeded);
      proposals.push(buildProposal(
        'direct',
        requestingParty,
        [contributor],
        seatsToUse,
        seatPool
      ));
    }
  });

  // ── Strategy 2: Multiple parties together cover needed seats ──────────────
  if (seatsNeeded > 1) {
    // Try all combinations of 2 contributors
    for (let i = 0; i < seatPool.length; i++) {
      for (let j = i + 1; j < seatPool.length; j++) {
        const combined = seatPool[i].count + seatPool[j].count;
        if (combined >= seatsNeeded) {
          const seatsToUse = [
            ...seatPool[i].availableSeats,
            ...seatPool[j].availableSeats,
          ].slice(0, seatsNeeded);
          proposals.push(buildProposal(
            'chain_3',
            requestingParty,
            [seatPool[i], seatPool[j]],
            seatsToUse,
            seatPool
          ));
        }
      }
    }

    // Try combinations of 3 contributors
    for (let i = 0; i < seatPool.length; i++) {
      for (let j = i + 1; j < seatPool.length; j++) {
        for (let k = j + 1; k < seatPool.length; k++) {
          const combined = seatPool[i].count + seatPool[j].count + seatPool[k].count;
          if (combined >= seatsNeeded) {
            const seatsToUse = [
              ...seatPool[i].availableSeats,
              ...seatPool[j].availableSeats,
              ...seatPool[k].availableSeats,
            ].slice(0, seatsNeeded);
            proposals.push(buildProposal(
              'chain_4',
              requestingParty,
              [seatPool[i], seatPool[j], seatPool[k]],
              seatsToUse,
              seatPool
            ));
          }
        }
      }
    }
  }

  // ── Deduplicate and rank ──────────────────────────────────────────────────
  const seen = new Set();
  const unique = proposals.filter(p => {
    const key = p.parties.map(x => x.id).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => b.fitScore - a.fitScore);

  logger.debug('Chain-swap engine v3 complete', {
    direct: unique.filter(p => p.type === 'direct').length,
    chain3: unique.filter(p => p.type === 'chain_3').length,
    chain4: unique.filter(p => p.type === 'chain_4').length,
  });

  return unique;
};

/**
 * Build a human-readable swap proposal.
 * The family gets seats in target coach.
 * Contributors get the family's vacated seats (distributed fairly).
 */
function buildProposal(type, requestingParty, contributors, seatsToReceive, fullPool) {
  const proposalId = [
  requestingParty.id,
  ...contributors.map(c => c.candidate.id),
].sort().join('-');
  // Family's vacated seats go to contributors (split across them)
  const vacatedSeats = (requestingParty.offeredCoaches ?? []).map((coach, i) => ({
    coach, berth: requestingParty.offeredBerths?.[i], berthType: requestingParty.offeredBerthTypes?.[i],
  }));

  // Distribute vacated seats to contributors
  let vacatedIdx = 0;
  const moves = [];

  // Family receives seats in target coach
  moves.push({
    fromPartyId: contributors.map(c => c.candidate.id).join('+'),
    toPartyId: requestingParty.id,
    description: `You move to ${seatsToReceive.map(s => `${s.coach}·${s.berth}(${s.berthType})`).join(', ')}`,
    seats: seatsToReceive,
    isRequester: true,
  });

  // Each contributor gets some of the vacated seats
  contributors.forEach(contributor => {
    const give = vacatedSeats.slice(vacatedIdx, vacatedIdx + contributor.count);
    vacatedIdx += contributor.count;
    if (give.length > 0) {
      moves.push({
        fromPartyId: requestingParty.id,
        toPartyId: contributor.candidate.id,
        description: `They move to ${give.map(s => `${s.coach}·${s.berth}(${s.berthType})`).join(', ')}`,
        seats: give,
        isRequester: false,
      });
    }
  });

  // Fit score
  const avgReceivedQuality = seatsToReceive.reduce((s, b) => s + berthQuality(b.berthType), 0) / seatsToReceive.length;
  const avgOfferedQuality = vacatedSeats.reduce((s, b) => s + berthQuality(b.berthType), 0) / (vacatedSeats.length || 1);
  const qualityGain = avgReceivedQuality - avgOfferedQuality;

  let fitScore = 60;
  if (type === 'direct') fitScore += 20;
  if (qualityGain > 0) fitScore += 10;
  if (qualityGain < -1) fitScore -= 15;
  if (contributors.some(c => c.candidate.hasNudge)) fitScore += 10;
  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  return {
    id: proposalId, 
    type,
    parties: [
      { id: requestingParty.id, isRequester: true },
      ...contributors.map(c => ({ id: c.candidate.id, hasNudge: c.candidate.hasNudge, nudgeDescription: c.candidate.nudgeDescription, maskedPnr: null })),
    ],
    moves,
    fitScore,
    seatsYouGet: seatsToReceive,
    contributorCount: contributors.length,
    description: type === 'direct'
      ? `1 person swaps ${contributors[0].count} seat${contributors[0].count > 1 ? 's' : ''} with you`
      : `${contributors.length} people together free up ${seatsToReceive.length} seats for you`,
  };
}