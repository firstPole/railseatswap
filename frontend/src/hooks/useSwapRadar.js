/**
 * useSwapRadar v2
 * ---------------
 * - Returns matches from local state (not Zustand) so updates are instant
 * - Returns sessionExpiresAt + matchExpiresAt for timers in DiscoverPage
 * - Realtime subscription triggers immediate re-fetch
 * - Polling fallback every 30s
 * - Visibility API re-fetches on tab focus
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { apiClient } from '../lib/apiClient.js';

const POLL_INTERVAL_MS = 30_000;
// Radar session = 5 hours from first load (matches departure window)
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

export function useSwapRadar(swapId, trainNumber, journeyDate,userId) {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);
    const [newMatchAlert, setNewMatchAlert] = useState(false);
    // Session expiry — fixed from mount, used for countdown in RadarHero
    const [sessionExpiresAt] = useState(() => new Date(Date.now() + SESSION_DURATION_MS));
    // Per-match expiry — 15 min TTL from when match was first seen
    const [matchExpiresAt, setMatchExpiresAt] = useState({});

    const prevCountRef = useRef(0);
    const pollRef = useRef(null);
    const channelRef = useRef(null);
    const matchFirstSeenRef = useRef({}); // track when each match was first seen
    const [incomingSignal, setIncomingSignal] = useState(null);
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fetchMatches = useCallback(async (silent = false) => {
        if (!swapId || !UUID_REGEX.test(swapId)) return;
        if (!silent) setLoading(true);
        try {
            const res = await apiClient.get(`/swaps/${swapId}/matches`);
            const incoming = res.data?.chains ?? [];

            // Track first-seen time for each match (for per-match TTL)
            const now = Date.now();
            const newExpiryMap = { ...matchExpiresAt };
            incoming.forEach((m, i) => {
                const key = m.id ?? `match-${i}`;
                if (!matchFirstSeenRef.current[key]) {
                    matchFirstSeenRef.current[key] = now;
                    newExpiryMap[key] = new Date(now + 15 * 60 * 1000); // 15 min TTL per match
                }
            });
            setMatchExpiresAt(newExpiryMap);

            // New match alert
            if (incoming.length > prevCountRef.current && prevCountRef.current >= 0) {
                setNewMatchAlert(true);
                setTimeout(() => setNewMatchAlert(false), 4000);
            }
            prevCountRef.current = incoming.length;

            setMatches(prev => {
                // Deduplicate by the actual seat content, not random id
                const key = (m) => m.moves?.map(mv =>
                    mv.seats?.map(s => `${s.coach}${s.berth}`).join('')
                ).join('|') ?? m.id;

                const existingKeys = new Set(prev.map(key));
                const newOnes = incoming.filter(m => !existingKeys.has(key(m)));
                return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
            setLastChecked(new Date());
        } catch (err) {
            console.warn('[Radar] Fetch failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [swapId]);

    // Initial fetch
    useEffect(() => {
        if (swapId) fetchMatches();
    }, [swapId, fetchMatches]);

    // Supabase Realtime
    useEffect(() => {
        console.log('[Radar] Subscription useEffect running', { swapId, trainNumber, journeyDate });
        if (!trainNumber || !journeyDate || !swapId) {
            console.log('[Radar] Missing params — skipping subscription');
            return;
        }

        const channel = supabase
            .channel(`radar:${swapId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'swap_requests',
                filter: `train_number=eq.${trainNumber}`,
            }, (payload) => {
                if (payload.new?.journey_date === journeyDate) {
                    fetchMatches(true);
                }
            })
            .on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'signals',
}, (payload) => {
  console.log('[Radar] Signal updated:', payload.new);
  if (payload.new?.from_user_id === userId && payload.new?.status === 'accepted') {
    setIncomingSignal({ ...payload.new, status: 'accepted' });
  }
})
            .subscribe(status => console.log('[Radar] Realtime status:', status));

        channelRef.current = channel;
        return () => supabase.removeChannel(channel);
    }, [swapId, trainNumber, journeyDate, fetchMatches]);

    // Polling fallback
    useEffect(() => {
        if (!swapId) return;
        pollRef.current = setInterval(() => fetchMatches(true), POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [swapId, fetchMatches]);

    // Visibility API
    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'visible' && swapId) fetchMatches(true);
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [swapId, fetchMatches]);

    return {
        matches,
        loading,
        lastChecked,
        newMatchAlert,
        sessionExpiresAt,
        matchExpiresAt,
        incomingSignal,
        setIncomingSignal,
        refetch: fetchMatches,
    };
}