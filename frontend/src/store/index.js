import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';
import { apiClient } from '../lib/apiClient.js';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, loading: false }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

export const useSwapStore = create((set, get) => ({
  mySwaps: [],
  activeSwap: null,
  matches: [],
  loadingMatches: false,

  setActiveSwap: (swap) => set({ activeSwap: swap }),

  fetchMySwaps: async () => {
    const data = await apiClient.get('/swaps');
    set({ mySwaps: data.data });
  },

  fetchMatches: async (swapId) => {
    set({ loadingMatches: true });
    try {
      const data = await apiClient.get(`/swaps/${swapId}/matches`);
      set({ matches: data.data.chains });
    } finally {
      set({ loadingMatches: false });
    }
  },
}));

export const useConfigStore = create((set) => ({
  feeEnabled: false,
  feeInr: 0,
  loaded: false,
  load: async () => {
    try {
      const data = await apiClient.get('/payments/config');
      set({ feeEnabled: data.data.feeEnabled, feeInr: data.data.feeInr, loaded: true });
    } catch {
      set({ feeEnabled: false, feeInr: 0, loaded: true });
    }
  },
}));
