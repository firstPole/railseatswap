import axios from 'axios';
import { supabase } from './supabase.js';
import { useAuthStore } from '../store/index.js';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Type': /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
    'X-App-Version': import.meta.env.VITE_APP_VERSION ?? '1.0.0',
    'X-Session-ID': sessionStorage.getItem('ss_session') ?? (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem('ss_session', id);
      return id;
    })(),
  },
});

apiClient.interceptors.request.use(async (config) => {
  console.group(`[API] ${config.method?.toUpperCase()} ${config.url}`);

  const { data: { session } } = await supabase.auth.getSession();
  console.log('[AUTH] Supabase session:', session ? 'EXISTS' : 'NULL');
  console.log('[AUTH] Supabase token:', session?.access_token ?? 'NONE');

  const storeSession = useAuthStore.getState().session;
  console.log('[AUTH] Zustand session:', storeSession ? 'EXISTS' : 'NULL');
  console.log('[AUTH] Zustand token:', storeSession?.access_token ?? 'NONE');

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
    console.log('[AUTH] Using Supabase token');
  } else if (storeSession?.access_token) {
    config.headers.Authorization = `Bearer ${storeSession.access_token}`;
    console.log('[AUTH] Using Zustand mock token');
  } else {
    // Last resort — sessionStorage (tab-isolated)
    const tabToken = sessionStorage.getItem('mock_token');
    if (tabToken) {
      config.headers.Authorization = `Bearer ${tabToken}`;
      console.log('[AUTH] Using sessionStorage token');
    } else {
      console.warn('[AUTH] ⚠️ No token found — request will be rejected');
    }
  }

  console.log('[AUTH] Final Authorization header:', config.headers.Authorization ?? 'NOT SET');
  console.groupEnd();
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    console.log(`[API] ✅ ${res.config.url} →`, res.data);
    return res.data;
  },
  (err) => {
    const status = err.response?.status;
    const apiError = err.response?.data?.error;

    console.group(`[API] ❌ Error`);
    console.log('Status:', status);
    console.log('Code:', apiError?.code);
    console.log('Message:', apiError?.message);
    console.log('Full error:', err.response?.data);
    console.groupEnd();

    if (status === 401) {
      console.warn('[AUTH] 401 received — signing out and redirecting to /login');
      supabase.auth.signOut();
      window.location.href = '/login';
    }

    const error = new Error(apiError?.message ?? 'Something went wrong');
    error.code = apiError?.code ?? 'UNKNOWN';
    error.status = status;
    error.details = apiError?.details ?? null;
    return Promise.reject(error);
  }
);