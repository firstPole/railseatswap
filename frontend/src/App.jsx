import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import { useAuthStore } from './store/index.js';
import LoginPage from './pages/LoginPage.jsx';
import PartySetupPage from './pages/PartySetupPage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import { apiClient } from './lib/apiClient.js';

const requestPushPermission = async () => {
   console.log('[Push] requestPushPermission called');
  console.log('[Push] Notification in window:', 'Notification' in window);
  console.log('[Push] serviceWorker in navigator:', 'serviceWorker' in navigator);
  
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[Push] Not supported — exiting');
    return;
  }
  console.log('[Push] Current permission:', Notification.permission);
  // Register SW manually in dev
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn('SW registration failed:', err.message);
    return;
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission:', permission);
  if (permission !== 'granted') return;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });
    await apiClient.post('/push/subscribe', { subscription });
    console.log('[Push] Subscribed successfully');
  } catch (err) {
    console.warn('[Push] Subscription failed:', err.message);
  }
};


function AuthProvider({ children }) {
  const setSession = useAuthStore(s => s.setSession);
  const loading = useAuthStore(s => s.loading);

  useEffect(() => {
    // 1. Handle development mode routing variants cleanly
    const isPartyB = import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('party') === 'B';

    if (isPartyB) {
      sessionStorage.setItem('mock_token', 'mock-development-token-2');
      const mockSession = {
        access_token: 'mock-development-token-2',
        user: { id: '00000000-0000-0000-0000-000000000002', phone: '+919898989899' }
      };
      setSession(mockSession);
      requestPushPermission();
      return;
    }

    // 2. Align Zustand state with tab-isolated storage tokens on hard reload
    const tabToken = sessionStorage.getItem('mock_token');
    if (tabToken && !useAuthStore.getState().session) {
      console.log('[AUTH] Syncing tab-isolated storage token to Zustand state tree');
      const standardDevSession = {
        access_token: tabToken,
        user: { id: '00000000-0000-0000-0000-000000000002', phone: '+919898989899' }
      };
      setSession(standardDevSession);
      requestPushPermission();
    }

    // 3. Fallback to production Supabase session checks
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) requestPushPermission();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) requestPushPermission();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading…</div>;
  return children;
}

function ProtectedRoute({ children }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/" element={<ProtectedRoute><PartySetupPage /></ProtectedRoute>} />
          <Route path="/swaps/:swapId/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
