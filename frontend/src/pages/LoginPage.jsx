import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { track } from '../lib/analytics.js';
import { useAuthStore } from '../store/index.js';

const PHONE_REGEX = /^[6-9]\d{9}$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        track('auth.login_success').catch(() => { });
        navigate('/', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const sendOtp = async (e) => {
    e.preventDefault();
    setError(null);

    if (!PHONE_REGEX.test(phone)) {
      return setError('Enter a valid 10-digit Indian mobile number');
    }
    if (!consent) {
      return setError('Please accept the Terms & Privacy Policy to continue');
    }

    setLoading(true);
    try {
      if (import.meta.env.DEV && phone === '9898989898') {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await track('auth.otp_sent').catch(() => { });
        setStep('otp');
        return;
      }
const testEmail = 'worksource.me@gmail.com';
      const { error: err } = await supabase.auth.signInWithOtp({
  email: testEmail,
  options: { shouldCreateUser: true },
});

      if (err) throw err;
      await track('auth.otp_sent');
      setStep('otp');
    } catch (err) {
      setError(err.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) return setError('Enter the 6-digit OTP');

    setLoading(true);
    try {
      if (import.meta.env.DEV && phone === '9898989898') {
        if (otp !== '123456') throw new Error('Invalid OTP. Please try again.');
        await new Promise((resolve) => setTimeout(resolve, 600));

        // 1. SET THE SESSION IMMEDATELY to authorize the application state
        const mockSession = {
          access_token: 'mock-development-token',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            phone: `+91${phone}`,
            user_metadata: { role: 'developer' },
          },
        };

        sessionStorage.setItem('mock_token', 'mock-development-token');
        useAuthStore.getState().setSession(mockSession);

        // 2. NOW fire your tracking event (apiClient will cleanly find 'mock_token' in sessionStorage!)
        await track('auth.login_success').catch(() => { });

        // 3. Route cleanly to the home layout
        navigate('/', { replace: true });
        return;
      }

      const { data, error: err } = await supabase.auth.verifyOtp({
  email: `${phone}@seatswap.in`,
  token: otp,
  type: 'magiclink',
});

      if (err) throw err;

      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        phone: `+91${phone}`,
        device_type: /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
      }, { onConflict: 'id' });

      await track('auth.login_success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .login-input:focus { border-color: #1A237E !important; outline: none; box-shadow: 0 0 0 3px rgba(26,35,126,0.1); }
        .login-cta:hover:not(:disabled) { background: #E65100 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(245,124,0,0.4) !important; }
        .login-cta:disabled { opacity: 0.65; cursor: not-allowed; }
        .login-cta { transition: all 0.18s ease !important; }
        .login-textbtn:hover { text-decoration: underline; }
        .login-checkbox:focus-within { outline: 2px solid #1A237E; border-radius: 4px; }
      `}</style>

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="8" fill="#E8EAF6" />
            <path d="M7 10C7 8.34315 8.34315 7 10 7H18C19.6569 7 21 8.34315 21 10V17H7V10Z" fill="#1A237E" />
            <rect x="9" y="17" width="3" height="3" rx="1" fill="#1A237E" />
            <rect x="16" y="17" width="3" height="3" rx="1" fill="#1A237E" />
            <rect x="9.5" y="9.5" width="3.5" height="3" rx="0.75" fill="white" />
            <rect x="15" y="9.5" width="3.5" height="3" rx="0.75" fill="white" />
            <rect x="7" y="14" width="14" height="1" fill="#7986CB" />
            <rect x="5" y="17" width="18" height="1.5" rx="0.75" fill="#3949AB" />
          </svg>
          <span style={styles.logoText}>Sit With My Family</span>
        </div>

        {/* <h1 style={styles.title}>Sit with my family</h1> */}
        <p style={styles.subtitle}>Because every journey is better when loved ones sit together</p>

        {step === 'phone' ? (
          <form onSubmit={sendOtp}>
            <label style={styles.label}>Mobile number</label>
            <div style={styles.phoneRow}>
              <span style={styles.dialCode}>+91</span>
              <input
                className="login-input"
                style={styles.input}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>

            <label style={styles.checkRow} className="login-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.consentText}>
                I agree to the{' '}
                <a href="/terms" target="_blank" style={styles.link}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" style={styles.link}>Privacy Policy</a>.
                {' '}I understand SeatSwap <strong>facilitates discovery only</strong> and does not guarantee seat exchanges.
              </span>
            </label>

            {error && <p style={styles.error}>{error}</p>}

            <button className="login-cta" style={styles.cta} disabled={loading}>
              {loading ? 'Sending…' : 'Get OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <p style={styles.otpHint}>OTP sent to your registered email
              <button type="button" className="login-textbtn" style={styles.textBtn} onClick={() => setStep('phone')}>
                Change
              </button>
            </p>
            <label style={styles.label}>Enter 6-digit OTP</label>
            <input
              className="login-input"
              style={{ ...styles.input, letterSpacing: '0.35em', textAlign: 'center', fontSize: 22, fontWeight: 600 }}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              placeholder="— — — — — —"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button className="login-cta" style={styles.cta} disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </form>
        )}

        <p style={styles.disclaimer}>
          Your mobile number is used solely for authentication and service improvement.
          We never share individual data with third parties without consent.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: '#ECEEF5',
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 20,
    padding: '2rem 1.75rem',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 8px 40px rgba(26,35,126,0.10)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1A237E',
    letterSpacing: '-0.3px',
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 6px',
    color: '#0D1340',
    letterSpacing: '-0.5px',
    lineHeight: 1.25,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    margin: '0 0 28px',
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 8,
  },
  phoneRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 18,
  },
  dialCode: {
    background: '#F3F4F8',
    border: '1.5px solid #E5E7EB',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 600,
    color: '#1A237E',
    whiteSpace: 'nowrap',
  },
  input: {
    flex: 1,
    border: '1.5px solid #E5E7EB',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 15,
    color: '#111827',
    background: '#FAFAFA',
    width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 18,
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: 2,
    width: 16,
    height: 16,
    accentColor: '#1A237E',
    flexShrink: 0,
    cursor: 'pointer',
  },
  consentText: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 1.6,
  },
  link: {
    color: '#1A237E',
    textDecoration: 'none',
    fontWeight: 600,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    margin: '0 0 14px',
    padding: '10px 14px',
    background: '#FEF2F2',
    borderRadius: 10,
    border: '1px solid #FECACA',
    lineHeight: 1.4,
  },
  cta: {
    width: '100%',
    background: '#F57C00',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    boxShadow: '0 4px 14px rgba(245,124,0,0.3)',
    letterSpacing: '0.1px',
  },
  otpHint: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  textBtn: {
    background: 'none',
    border: 'none',
    color: '#1A237E',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
    fontSize: 14,
    fontFamily: 'inherit',
  },
  disclaimer: {
    fontSize: 11.5,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 1.6,
  },
};