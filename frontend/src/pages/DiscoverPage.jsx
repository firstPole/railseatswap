import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import { Analytics } from '../lib/analytics.js';
import { useSwapStore, useConfigStore } from '../store/index.js';
import { useSwapRadar } from '../hooks/useSwapRadar.js';

// ─────────────────────────────────────────────────────────────────────────────
// useSwapRadar must return:
//   matches        – array of match objects (grows as new ones arrive)
//   loading        – bool, true only on first load
//   lastChecked    – Date | null
//   newMatchAlert  – bool, flips true briefly when a new match arrives
//   sessionExpiresAt – Date (absolute), used for the real session countdown
//   matchExpiresAt   – map of { [matchId]: Date } for per-match expiry
// ─────────────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { swapId } = useParams();
  const { activeSwap, matches: storeMatches } = useSwapStore();

  const setActiveSwap = useSwapStore(s => s.setActiveSwap);
  useEffect(() => {
    if (!activeSwap && swapId) {
      console.log('[DiscoverPage] fetching swap for id:', swapId);
      apiClient.get('/swaps').then(res => {
        // apiClient already unwraps — res IS the response body
        const swaps = Array.isArray(res.data) ? res.data : [];
        console.log('[DiscoverPage] swaps:', swaps);
        const swap = swaps.find(s => s.id === swapId);
        console.log('[DiscoverPage] found:', swap);
        if (swap) setActiveSwap(swap);
      }).catch(err => console.error('[DiscoverPage] fetch failed:', err));
    }
  }, [swapId, activeSwap]);
  const {
    feeEnabled, feeInr,
    loaded: configLoaded,
    load: loadConfig,
  } = useConfigStore();

  const [paymentState, setPaymentState] = useState('idle');
  const [accessUnlocked, setAccessUnlocked] = useState(false);

  useEffect(() => { if (!configLoaded) loadConfig(); }, []);
  useEffect(() => {
    if (configLoaded && !feeEnabled) setAccessUnlocked(true);
  }, [configLoaded, feeEnabled]);

  const {
    matches,        
    loading,
    lastChecked,
    newMatchAlert,
    sessionExpiresAt,
    matchExpiresAt,
    incomingSignal,
    setIncomingSignal,
  } = useSwapRadar(
    accessUnlocked ? swapId : null,
    activeSwap?.train_number,
    activeSwap?.journey_date,
    user?.id,
  );


  const handleAccept = async (signal) => {
    try {
      await apiClient.post('/matches/signal/accept', { signalId: signal.id });
      // Replace navigate with a simple state update for now
      setIncomingSignal({ ...signal, status: 'accepted' });
    } catch {
      alert('Failed to accept. Please try again.');
    }
  };

  const handleDecline = async (signal) => {
    try {
      await apiClient.post('/matches/signal/decline', { signalId: signal.id });
      setIncomingSignal(null); // dismiss banner
    } catch {
      setIncomingSignal(null);
    }
  };
  // ── Payment ────────────────────────────────────────────────────────────────
  const initiatePayment = async () => {
    setPaymentState('loading');
    try {
      const res = await apiClient.post('/payments/discovery-order', {
        swapRequestId: swapId,
      });
      if (!res.data.feeRequired || res.data.alreadyPaid) {
        setAccessUnlocked(true);
        setPaymentState('paid');
        return;
      }
      const rzp = new window.Razorpay({
        key: res.data.keyId,
        order_id: res.data.orderId,
        amount: res.data.amountInr * 100,
        currency: 'INR',
        name: 'SeatSwap',
        theme: { color: '#E8430A' },
        handler: async (payment) => {
          await apiClient.post('/payments/verify', {
            orderId: res.data.orderId,
            paymentId: payment.razorpay_payment_id,
            signature: payment.razorpay_signature,
            swapRequestId: swapId,
          });
          setAccessUnlocked(true);
          setPaymentState('paid');
        },
        modal: { ondismiss: () => setPaymentState('idle') },
      });
      rzp.open();
    } catch {
      setPaymentState('error');
    }
  };

  if (!configLoaded) return <Loader />;
  if (feeEnabled && !accessUnlocked) {
    return (
      <PaymentGate
        feeInr={feeInr}
        state={paymentState}
        onPay={initiatePayment}
      />
    );
  }
  if (loading) return <Loader label="Starting radar…" />;

  if (incomingSignal?.status === 'accepted') {
  const newCoaches = incomingSignal.your_new_coaches ?? [];
  const newBerths = incomingSignal.your_new_berths ?? [];
  const giveCoaches = incomingSignal.your_give_coaches ?? [];
  const giveBerths = incomingSignal.your_give_berths ?? [];
  const shortCode = incomingSignal.short_code ?? 
    incomingSignal.match_id?.slice(-4).toUpperCase() ?? '????';
  const trainNumber = incomingSignal.train_number ?? activeSwap?.train_number ?? '—';
  const trainName = incomingSignal.train_name ?? activeSwap?.train_name ?? '—';
  const journeyDate = incomingSignal.journey_date ?? activeSwap?.journey_date ?? '—';
  const newSeatLabel = newCoaches.map((c, i) => `${c}·${newBerths[i]}`).join(', ');
  const giveSeatLabel = giveCoaches.map((c, i) => `${c}·${giveBerths[i]}`).join(', ');
  const primaryCoach = newCoaches[0] ?? '?';
  const primaryBerth = newBerths[0] ?? '?';

  return (
    <>
      <style>{CSS}</style>
      <div className="rc-page" style={{ minHeight: '100dvh', padding: '1.5rem', background: '#ECEEF5' }}>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 56 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#166534', margin: '8px 0 4px' }}>
            Swap Agreed!
          </h2>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
            Both passengers have confirmed
          </p>
        </div>

        {/* What to do now */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px', marginBottom: 12, border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A237E', margin: '0 0 12px' }}>
            📍 What to do now
          </p>
          <SwapStep num="1" text={`Go to Coach ${primaryCoach}, Seat ${primaryBerth} and sit there`} bold />
          <SwapStep num="2" text="When TTE checks tickets, show them the slip below" />
          <SwapStep num="3" text="Your PNR is still valid — only the physical seat changed" />
        </div>

        {/* TTE Confirmation Slip */}
        <div style={{ background: '#fff', border: '2px solid #1A237E', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          {/* Slip header */}
          <div style={{ background: '#1A237E', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Seat Swap Confirmation
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.1em' }}>
                SW-{shortCode}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px' }}>Show to TTE</p>
              <p style={{ fontSize: 11, color: '#fff', margin: 0 }}>
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
              </p>
            </div>
          </div>

          {/* Slip body */}
          <div style={{ padding: '14px 16px' }}>
            <SlipRow label="Train" value={`${trainNumber} · ${trainName}`} />
            <SlipRow label="Date" value={journeyDate} />
            <SlipRow label="Your PNR" value={`XXXXXX${activeSwap?.pnr?.slice(-4) ?? '????'}`} />

            <div style={{ borderTop: '1px dashed #e2e8f0', margin: '10px 0' }} />

            {/* Seat change visual */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#8892B0', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
              Seat change
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, background: '#fee2e2', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#991b1b', margin: '0 0 2px', fontWeight: 600 }}>Was sitting at</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#991b1b', margin: 0 }}>{giveSeatLabel || '—'}</p>
              </div>
              <div style={{ fontSize: 20 }}>→</div>
              <div style={{ flex: 1, background: '#dcfce7', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#166534', margin: '0 0 2px', fontWeight: 600 }}>Now sitting at</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#166534', margin: 0 }}>{newSeatLabel || '—'}</p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Both passengers voluntarily exchanged seats by mutual consent via SeatSwap.
                Original PNRs remain valid. Please verify identity against PNR at new seat.
              </p>
            </div>
          </div>
        </div>

        <button
          style={{ width: '100%', background: '#1A237E', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setIncomingSignal(null)}
        >
          Done
        </button>
      </div>
    </>
  );
}
  return (
    <>
      <style>{CSS}</style>
      <div className="rc-page">

        {/* Top nav */}
        <div style={S.topBar}>
          <div style={S.topBarInner}>
            <div style={S.navBrand}>
              <TrainLogoSVG />
              <span style={S.navBrandText}>Sit With My Family</span>
            </div>
            <AvatarSVG />
          </div>
        </div>

        {/* New-match toast */}
        {newMatchAlert && (
          <div style={S.toast}>🎉 New match found!</div>
        )}

        {incomingSignal && (
          <div style={{
            position: 'fixed', top: 60, left: 0, right: 0, zIndex: 100,
            background: '#1A237E', color: '#fff',
            padding: '14px 16px', margin: '0 14px',
            borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              🔔 Someone wants to swap with you!
            </p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
              They've seen your match and are interested. Do you agree to swap?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1, background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }} onClick={() => handleAccept(incomingSignal)}>
                ✅ Yes, I agree
              </button>
              <button style={{
                flex: 1, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }} onClick={() => handleDecline(incomingSignal)}>
                ❌ No thanks
              </button>
            </div>
          </div>
        )}
        <div style={S.scrollArea}>
          {/* Radar hero — changes state once matches arrive */}
          <RadarHero
            matchCount={matches.length}
            sessionExpiresAt={sessionExpiresAt}
            lastChecked={lastChecked}
          />

          {/* Match content */}
          <div style={S.matchSection}>
            {matches.length === 0 ? (
              <EmptyState />
            ) : (
              <MatchList
                matches={matches}
                activeSwap={activeSwap}
                matchExpiresAt={matchExpiresAt}
              />
            )}
          </div>
        </div>

        <BottomTabBar activeTab="radar" />
      </div>
    </>
  );
}


function SwapStep({ num, text, bold }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1A237E', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {num}
      </div>
      <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5, fontWeight: bold ? 700 : 400 }}>
        {text}
      </p>
    </div>
  );
}

function SlipRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: '#8892B0', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#111', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
// ── Radar Hero ────────────────────────────────────────────────────────────────
// sessionExpiresAt is a real Date from the backend — this component computes
// seconds-remaining from it so the countdown is accurate even on re-mounts.
function RadarHero({ matchCount, sessionExpiresAt, lastChecked }) {
  const [secsLeft, setSecsLeft] = useState(() =>
    sessionExpiresAt
      ? Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const tick = () =>
      setSecsLeft(Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionExpiresAt]);

  const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');
  const sessionExpired = secsLeft === 0;
  const hasMatches = matchCount > 0;

  // Title changes based on state
  const title = sessionExpired
    ? 'Radar session ended'
    : hasMatches
      ? `${matchCount} match${matchCount > 1 ? 'es' : ''} found!`
      : 'Searching for Matches...';

  return (
    <div style={S.radarHero}>
      <h2 style={{
        ...S.radarTitle,
        color: hasMatches ? '#C03000' : '#0D1340',
      }}>
        {title}
      </h2>

      {/* Session timer — this is the radar duration, NOT match expiry */}
      {!sessionExpired && (
        <div style={{
          ...S.timerPill,
          background: secsLeft < 600 ? '#E8430A' : '#1A237E',
        }}>
          <ClockSVG />
          <span style={S.timerText}>{hh}:{mm}:{ss}</span>
          <span style={S.timerLabel}>radar active</span>
        </div>
      )}

      {sessionExpired && (
        <div style={{ ...S.timerPill, background: '#6B7280' }}>
          <span style={S.timerText}>Session ended</span>
        </div>
      )}

      {/* Radar animation */}
      <div style={S.radarWrap}>
        <div style={S.radarRing1} />
        <div style={S.radarRing2} />
        <div style={S.radarInnerRing} />
        <div style={{
          ...S.radarCenter,
          background: hasMatches ? '#C03000' : '#1A237E',
        }}>
          <RadarIconSVG />
        </div>
        <div style={S.floatIconLeft}><PersonLockSVG /></div>
        <div style={S.floatIconRight}><TrainLogoSVG /></div>
        <div style={S.floatIconBottom}><DownloadSVG /></div>
      </div>

      {/* Match count badge — shown below radar once matches exist */}
      {hasMatches && (
        <div style={S.matchFoundBadge}>
          <span style={S.liveBlip} />
          {matchCount} match{matchCount > 1 ? 'es' : ''} found — radar still scanning
        </div>
      )}
    </div>
  );
}

// ── Match list ────────────────────────────────────────────────────────────────
function MatchList({ matches, activeSwap, matchExpiresAt }) {
  return (
    <>
      {/* Urgency banner uses the FIRST match's expiry, not the session timer */}
      <UrgencyBanner
        matchCount={matches.length}
        expiresAt={matchExpiresAt?.[matches[0]?.id]}
      />

      <div style={S.matchHeader}>
        <h2 style={S.heading}>We found a way! 🎯</h2>
        <p style={S.subtext}>
          {matches.length} option{matches.length > 1 ? 's' : ''} — act before they expire
        </p>
      </div>

      {/* Discovery disclaimer — shown once, above all cards */}
      <DiscoveryDisclaimer />

      {matches.map((match, i) => (
        <MatchCard
          key={match.id ?? i}
          match={match}
          rank={i + 1}
          activeSwap={activeSwap}
          recommended={i === 0}
          expiresAt={matchExpiresAt?.[match.id]}
        />
      ))}

      <p style={S.legalNote}>
        These are possibilities only — not confirmed bookings. Both passengers
        must agree to swap. Please inform your TTE after changing seats.
      </p>
    </>
  );
}

// ── Discovery disclaimer ──────────────────────────────────────────────────────
function DiscoveryDisclaimer() {
  return (
    <div style={S.disclaimer}>
      <InfoSVG />
      <div>
        <p style={S.disclaimerTitle}>What you're paying for — and what you're not</p>
        <div style={S.disclaimerGrid}>
          <p style={S.disclaimerYes}>✅ We show you <strong>who</strong> may want to swap</p>
          <p style={S.disclaimerYes}>✅ You get their <strong>coach &amp; seat number</strong></p>
          <p style={S.disclaimerYes}>✅ A shared <strong>match code</strong> to identify each other</p>
          <p style={S.disclaimerNo}>❌ We do <strong>not</strong> arrange or confirm any swap</p>
          <p style={S.disclaimerNo}>❌ We do <strong>not</strong> involve IRCTC or railway staff</p>
        </div>
      </div>
    </div>
  );
}

// ── Urgency banner ────────────────────────────────────────────────────────────
// expiresAt is a real Date from the backend — completely separate from session timer
function UrgencyBanner({ matchCount, expiresAt }) {
  const [secs, setSecs] = useState(() =>
    expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 900,
  );

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setSecs(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const urgent = secs < 300;

  return (
    <div style={{
      ...S.urgencyBanner,
      background: urgent ? '#FFF0ED' : '#FFF8ED',
      borderColor: urgent ? '#E8430A' : '#F59E0B',
    }}>
      <div style={S.urgencyLeft}>
        <div style={{
          ...S.urgencyDot,
          background: urgent ? '#E8430A' : '#F59E0B',
          boxShadow: urgent
            ? '0 0 0 4px rgba(232,67,10,0.2)'
            : '0 0 0 4px rgba(245,158,11,0.2)',
        }} />
        <div>
          <p style={{ ...S.urgencyTitle, color: urgent ? '#C03000' : '#92400E' }}>
            {urgent
              ? '⚡ Act now — match expiring!'
              : `🎯 ${matchCount} match${matchCount > 1 ? 'es' : ''} found for your journey`}
          </p>
          <p style={S.urgencyDesc}>
            {urgent
              ? 'This passenger may leave the platform soon.'
              : 'This passenger is actively looking to swap.'}{' '}
            Matches are not reserved — first to connect wins.
          </p>
        </div>
      </div>
      <div style={{
        ...S.urgencyTimer,
        color: urgent ? '#C03000' : '#92400E',
        background: urgent ? '#FFE4DC' : '#FEF3C7',
        borderColor: urgent ? '#FDDDD4' : '#FDE68A',
      }}>
        <span style={S.urgencyTimerLabel}>Match expires</span>
        <span style={{ ...S.urgencyTimerVal, color: urgent ? '#C03000' : '#92400E' }}>
          {mm}:{ss}
        </span>
      </div>
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, rank, activeSwap, recommended, expiresAt }) {
  const [expanded, setExpanded] = useState(rank === 1);
  const [signalSent, setSignalSent] = useState(false);

  const youGet = match.moves?.find(m => m.isRequester)?.seats ?? [];
  const theyGet = match.moves?.find(m => !m.isRequester)?.seats ?? [];
  const youGive = theyGet;

  const isMultiParty = (match.contributorCount ?? 1) > 1;
  const tagLabel = isMultiParty
    ? 'MULTI-PARTY CHAIN'
    : `DIRECT SWAP (${youGet[0]?.coach ?? 'B1'})`;
  const tagColor = isMultiParty ? '#7C3AED' : '#374151';
  const tagBg = isMultiParty ? '#EDE9FE' : '#F3F4F6';
  const titleText = isMultiParty
    ? `${match.contributorCount ?? 3}-Way Chain!`
    : '1-to-1 Match!';
  const titleColor = isMultiParty ? '#C03000' : '#1A237E';
  const descText = isMultiParty
    ? `You → ${youGet.map(s => s.coach).join(' → ')} → You. All ${youGet.length + youGive.length} seats unified. Ideal for groups.`
    : `Passenger in ${youGet[0]?.coach ?? 'B1'} wants ${youGive[0]?.coach ?? 'B4'}. Swap and sit together.`;
  const ctaText = isMultiParty ? 'Execute Chain' : 'Connect →';
  const ctaStyle = isMultiParty ? S.ctaBtnOrange : S.ctaBtnNavy;

  const handleSignal = async () => {
  try {
    const youGet = match.moves?.find(m => m.isRequester)?.seats ?? [];
    const youGive = match.moves?.find(m => !m.isRequester)?.seats ?? [];

    await apiClient.post('/matches/signal', {
      matchId: match.code ?? match.id?.slice(-4).toUpperCase(),
      swapRequestId: match.parties?.find(p => !p.isRequester)?.id ?? swapId,
      // Pass seat details for TTE slip
      yourNewCoaches: youGet.map(s => s.coach),
      yourNewBerths: youGet.map(s => s.berth),
      yourGiveCoaches: youGive.map(s => s.coach),
      yourGiveBerths: youGive.map(s => s.berth),
      trainNumber: activeSwap?.train_number,
      trainName: activeSwap?.train_name,
      journeyDate: activeSwap?.journey_date,
      shortCode: match.code ?? match.id?.slice(-4).toUpperCase(),
    });
    setSignalSent(true);
  } catch {
    setSignalSent(true);
  }
};

  return (
    <div
      className="rc-match-card"
      style={{
        ...S.matchCard,
        ...(recommended ? S.matchCardRecommended : {}),
        animationDelay: `${(rank - 1) * 0.1}s`,
      }}
    >
      {recommended && <div style={S.recommendedBanner}>RECOMMENDED</div>}

      <div style={S.matchCardTop}>
        <div style={{ ...S.matchTypeTag, background: tagBg, color: tagColor }}>
          {tagLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Per-match expiry pill — NOT the session timer */}
          <MatchExpiryPill expiresAt={expiresAt} />
        </div>
      </div>

      <h3 style={{ ...S.matchTitle, color: titleColor }}>{titleText}</h3>
      <p style={S.matchDesc}>{descText}</p>

      <div style={S.matchFooter}>
        <div style={S.seatChipsRow}>
          <div style={S.youChip}>YOU</div>
          {[...youGet, ...youGive].slice(0, 3).map((s, i) => (
            <CoachChip key={i} label={s.coach ?? `B${i + 1}`} highlight={i < youGet.length} />
          ))}
          {isMultiParty && (
            <div style={S.optimizedRoute}>
              <span style={S.optimizedLabel}>Optimized Route</span>
            </div>
          )}
        </div>
        <button style={ctaStyle} onClick={handleSignal} disabled={signalSent}>
          {signalSent ? '✅ Notified — waiting for response' : '📡 I\'m interested — notify them'}
        </button>
      </div>

      {expanded && (
        <>
          <BeforeAfter
            activeSwap={activeSwap}
            youGet={youGet}
            youGive={youGive}
          />
          <div style={S.summaryLines}>
            <p style={S.summaryLine}>
              ✅ Your family gets seats{' '}
              <strong>{youGet.map(s => `${s.coach}·${s.berth}`).join(', ')}</strong>
            </p>
            <p style={S.summaryLine}>
              🔄 You give seats{' '}
              <strong>{youGive.map(s => `${s.coach}·${s.berth}`).join(', ')}</strong>
            </p>
            <p style={S.summaryLine}>
              👥 {match.contributorCount === 1 ? '1 person' : `${match.contributorCount} people`} involved
            </p>
          </div>

          {match.parties?.some(p => p.hasNudge) && (
            <div style={S.nudgePill}>
              🎁 They're offering:{' '}
              <strong>{match.parties.find(p => p.hasNudge)?.nudgeDescription}</strong>
            </div>
          )}

          {/* ── Coordination section — new ── */}
          <CoordinationCard
            match={match}
            youGet={youGet}
            signalSent={signalSent}
            onSignal={handleSignal}
          />
        </>
      )}

      <button style={S.expandToggle} onClick={() => setExpanded(e => !e)}>
        {expanded ? 'Show less ▲' : 'Show details ▼'}
      </button>
    </div>
  );
}

// ── Coordination card ─────────────────────────────────────────────────────────
// Replaces the vague "important note". Gives both parties a shared match code
// and step-by-step instructions to find each other on the train.
function CoordinationCard({ match, youGet, signalSent, onSignal }) {
  // match.code should come from backend; fallback to last 4 of match.id
  const code = match.code ?? match.id?.slice(-4).toUpperCase() ?? '????';
  const targetCoach = youGet[0]?.coach ?? '?';
  const targetBerth = youGet[0]?.berth ?? '?';

  return (
    <div style={S.coordCard}>
      <p style={S.coordTitle}>
        🤝 How to connect on the train
      </p>

      {/* Shared match code */}
      <div style={S.matchCodeBox}>
        <p style={S.matchCodeLabel}>Your match code — both passengers show this</p>
        <div style={S.matchCodeValue}>#{code}</div>
      </div>

      <div style={S.coordSteps}>
        <CoordStep num="1">
          Walk to <strong>Coach {targetCoach}, Seat {targetBerth}</strong>.
          Open RailConnect and show your match screen.
        </CoordStep>
        <CoordStep num="2">
          Tap <strong>"Signal interest"</strong> below — the other passenger
          gets a notification that you've found the match.
        </CoordStep>
        <CoordStep num="3">
          Once both agree, <strong>tell your TTE</strong> — show this screen.
          The app generates a confirmation note you can both display.
        </CoordStep>
      </div>

      <button
        className="rc-cta-btn"
        style={signalSent ? S.signalBtnSent : S.signalBtn}
        onClick={!signalSent ? onSignal : undefined}
        disabled={signalSent}
      >
        {signalSent
          ? '✅ Signal sent — waiting for them to respond'
          : '📡 Signal interest to other passenger'}
      </button>

      <p style={S.coordDisclaimer}>
        Signalling notifies the other passenger. It does not confirm a swap.
        Both must agree in person and inform your TTE.
      </p>
    </div>
  );
}

function CoordStep({ num, children }) {
  return (
    <div style={S.coordStep}>
      <div style={S.coordStepNum}>{num}</div>
      <p style={S.coordStepText}>{children}</p>
    </div>
  );
}

// ── Before/after section ──────────────────────────────────────────────────────
function BeforeAfter({ activeSwap, youGet, youGive }) {
  return (
    <div style={S.beforeAfterWrap}>
      <p style={S.baLabel}>What happens if you accept</p>
      <div style={S.beforeAfter}>
        <div style={S.baBox}>
          <p style={S.baBoxLabel}>Now 😕</p>
          <div style={S.baSeats}>
            {(activeSwap?.current_coaches ?? []).map((coach, i) => (
              <SeatTag
                key={i}
                coach={coach}
                berth={activeSwap?.current_berths?.[i]}
                type={activeSwap?.berth_types?.[i]}
                highlight={activeSwap?.offered_coaches?.includes(coach)}
              />
            ))}
          </div>
        </div>
        <div style={S.baArrow}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10h12M12 6l4 4-4 4" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={S.baBox}>
          <p style={S.baBoxLabel}>After swap 😊</p>
          <div style={S.baSeats}>
            {(activeSwap?.current_coaches ?? [])
              .filter((_, i) => !activeSwap?.offered_coaches?.includes(activeSwap?.current_coaches?.[i]))
              .map((coach, i) => (
                <SeatTag key={`stay-${i}`} coach={coach} berth={activeSwap?.current_berths?.[i]} type={activeSwap?.berth_types?.[i]} />
              ))}
            {youGet.map((s, i) => (
              <SeatTag key={`new-${i}`} coach={s.coach} berth={s.berth} type={s.berthType} isNew />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Per-match expiry pill ─────────────────────────────────────────────────────
// expiresAt is a real Date from backend — completely independent of session timer
function MatchExpiryPill({ expiresAt }) {
  const [secs, setSecs] = useState(() =>
    expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 900,
  );

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setSecs(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const urgent = secs < 300;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: urgent ? '#FFE4DC' : '#F4F5FA',
      border: `1px solid ${urgent ? '#FDDDD4' : '#E8EAF0'}`,
      borderRadius: 20, padding: '3px 8px',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: urgent ? '#E8430A' : '#8892B0',
      }} />
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: urgent ? '#C03000' : '#6B7280',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {mm}:{ss}
      </span>
    </div>
  );
}

// ── Primitive components ──────────────────────────────────────────────────────
function CoachChip({ label, highlight }) {
  return (
    <div style={{
      ...S.coachChip,
      background: highlight ? '#1A237E' : '#E8EAF6',
      color: highlight ? '#fff' : '#1A237E',
    }}>
      {label}
    </div>
  );
}

function SeatTag({ coach, berth, type, highlight, isNew }) {
  return (
    <div style={{
      ...S.seatTag,
      background: isNew ? '#DCFCE7' : highlight ? '#FEE2E2' : '#F4F5FA',
      borderColor: isNew ? '#22C55E' : highlight ? '#EF4444' : '#D0D4E8',
      color: isNew ? '#166534' : highlight ? '#991B1B' : '#374151',
    }}>
      <span style={{ opacity: 0.75, fontSize: 10 }}>{coach}</span>
      <span style={{ fontWeight: 700 }}>·{berth}</span>
      {isNew && <span style={S.newBadge}>NEW</span>}
    </div>
  );
}

// ── Bottom tab bar ────────────────────────────────────────────────────────────
function BottomTabBar({ activeTab }) {
  const tabs = [
    {
      id: 'entry', label: 'Entry',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>,
    },
    {
      id: 'layout', label: 'Layout',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="15" y="13" width="6" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>,
    },
    {
      id: 'goals', label: 'Goals',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
    },
    {
      id: 'radar', label: 'Radar',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" strokeOpacity=".5" /><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
    },
    {
      id: 'blueprint', label: 'Blueprint',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M7 8h5M7 12h10M7 16h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
    },
  ];

  return (
    <div style={S.tabBar}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className="tab-item"
            style={{ ...S.tabItem, color: isActive ? '#E8430A' : '#8892B0' }}
          >
            <div style={{ ...S.tabIcon, ...(isActive ? S.tabIconActive : {}) }}>
              {tab.icon}
            </div>
            <span style={{ ...S.tabLabel, fontWeight: isActive ? 600 : 400 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={S.emptyCard}>
      <h2 style={S.emptyTitle}>Watching{dots}</h2>
      <p style={S.emptyDesc}>
        No matching passengers yet. Your request is live — we'll show options
        here the moment someone appears.{' '}
        <strong>You don't need to do anything.</strong>
      </p>
      <div style={S.emptySteps}>
        <EmptyStep icon="📡" title="Radar is active" desc="Checking every 30 seconds automatically" />
        <EmptyStep icon="🔔" title="Instant alert" desc="Match appears here the moment someone is found" />
        <EmptyStep icon="🤝" title="You decide" desc="You choose whether to connect — nothing happens automatically" />
      </div>
      <div style={S.emptyTip}>
        <p style={{ fontSize: 12, color: '#78350F', margin: 0, lineHeight: 1.5 }}>
          💡 <strong>Best time:</strong> Matches appear most often 4 hours before
          departure when IRCTC publishes the seat chart.
        </p>
      </div>
    </div>
  );
}

function EmptyStep({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#0D1340' }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}

// ── Payment gate ──────────────────────────────────────────────────────────────
function PaymentGate({ feeInr, state, onPay }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", background: '#ECEEF5',
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.5rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>🔍</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0D1340', margin: '0 0 10px' }}>
        Matches found!
      </h2>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.6 }}>
        We found people on your train who may be able to swap seats.
        Pay a small fee to see who they are and where they're sitting.
      </p>
      <div style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff', border: '2px solid #1A237E', borderRadius: 14,
        padding: '14px 32px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: '#1A237E' }}>₹{feeInr}</span>
        <span style={{ fontSize: 12, color: '#8892B0' }}>one-time per journey</span>
      </div>
      <div style={{
        background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 10,
        padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#78350F',
        lineHeight: 1.5, textAlign: 'left', maxWidth: 340,
      }}>
        <strong>What you get:</strong> coach &amp; seat numbers of passengers who may
        want to swap, plus a shared match code to identify each other on the train.{' '}
        <strong>We do not confirm or guarantee any seat change.</strong>
      </div>
      <button
        className="rc-cta-btn"
        style={S.ctaBtnNavy}
        onClick={onPay}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Opening…' : `Pay ₹${feeInr} & see matches`}
      </button>
      {state === 'error' && (
        <p style={{ color: '#E8430A', fontSize: 13, marginTop: 8 }}>
          Payment failed. Please try again.
        </p>
      )}
    </div>
  );
}

function Loader({ label = 'Loading…' }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", minHeight: '60vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, color: '#6B7280', background: '#ECEEF5',
    }}>
      <div style={{ fontSize: 40 }}>🚂</div>
      <p style={{ fontSize: 14 }}>{label}</p>
    </div>
  );
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
function TrainLogoSVG() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#E8EAF6" />
      <path d="M7 10C7 8.34 8.34 7 10 7H18C19.66 7 21 8.34 21 10V17H7V10Z" fill="#1A237E" />
      <rect x="9" y="17" width="3" height="3" rx="1" fill="#1A237E" />
      <rect x="16" y="17" width="3" height="3" rx="1" fill="#1A237E" />
      <rect x="9.5" y="9.5" width="3.5" height="3" rx=".75" fill="white" />
      <rect x="15" y="9.5" width="3.5" height="3" rx=".75" fill="white" />
      <rect x="7" y="14" width="14" height="1" fill="#7986CB" />
      <rect x="5" y="17" width="18" height="1.5" rx=".75" fill="#3949AB" />
    </svg>
  );
}
function AvatarSVG() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#E8EAF6" />
      <circle cx="14" cy="11" r="4" fill="#9FA8DA" />
      <path d="M6 23c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#9FA8DA" />
    </svg>
  );
}
function ClockSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7.5" r="5.5" stroke="white" strokeWidth="1.3" />
      <path d="M7 5v2.5l1.5 1" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 1.5h3" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function RadarIconSVG() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="white" strokeWidth="2" strokeOpacity=".4" />
      <circle cx="18" cy="18" r="7" stroke="white" strokeWidth="2" />
      <circle cx="18" cy="18" r="2.5" fill="white" />
      <path d="M18 4v4M18 28v4M4 18h4M28 18h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function PersonLockSVG() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7" r="3" fill="#E8430A" />
      <path d="M5 19c0-4 3-7 7-7" stroke="#E8430A" strokeWidth="2" strokeLinecap="round" />
      <rect x="14" y="13" width="7" height="5" rx="1.5" stroke="#E8430A" strokeWidth="1.5" />
      <path d="M15.5 13v-1.5a1.5 1.5 0 013 0V13" stroke="#E8430A" strokeWidth="1.5" />
    </svg>
  );
}
function DownloadSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-2" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 12v8M9 17l3 3 3-3" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function InfoSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="7" stroke="#92400E" strokeWidth="1.4" />
      <path d="M8 6v4M8 11v.5" stroke="#92400E" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .rc-page { font-family: 'DM Sans', sans-serif; background: #ECEEF5; min-height: 100dvh; }
  @keyframes pulse-ring {
    0%   { transform: scale(0.85); opacity: 0.6; }
    70%  { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(0.85); opacity: 0; }
  }
  @keyframes float-icon {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .rc-match-card { animation: slide-up 0.3s ease both; }
  .rc-cta-btn:hover:not(:disabled) { filter: brightness(0.92); transform: translateY(-1px); }
  .rc-cta-btn { transition: all 0.18s ease; }
  .tab-item:hover { color: #1A237E; }
`;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  topBar: { background: '#fff', borderBottom: '1px solid #E8EAF0', position: 'sticky', top: 0, zIndex: 10 },
  topBarInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', maxWidth: 480, margin: '0 auto' },
  navBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  navBrandText: { fontSize: 17, fontWeight: 700, color: '#1A237E', letterSpacing: '-0.3px' },
  scrollArea: { maxWidth: 480, margin: '0 auto', paddingBottom: 80 },
  toast: { position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: '#1A237E', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' },

  // Radar hero
  radarHero: { background: '#ECEEF5', paddingTop: 24, paddingBottom: 32, textAlign: 'center', position: 'relative' },
  radarTitle: { fontSize: 20, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.3px' },
  timerPill: { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#fff', borderRadius: 24, padding: '6px 14px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 28, boxShadow: '0 4px 14px rgba(26,35,126,0.3)' },
  timerText: { fontSize: 14, fontVariantNumeric: 'tabular-nums' },
  timerLabel: { fontSize: 10 },

  radarWrap: { position: 'relative', width: 180, height: 180, margin: '0 auto' },
  radarRing1: { position: 'absolute', inset: -20, borderRadius: '50%', border: '1.5px solid rgba(26,35,126,0.18)', animation: 'pulse-ring 2.5s ease-out infinite' },
  radarRing2: { position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(26,35,126,0.25)' },
  radarInnerRing: { position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(26,35,126,0.12)', background: 'rgba(255,255,255,0.5)' },
  radarCenter: { position: 'absolute', inset: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(26,35,126,0.4)', transition: 'background 0.4s ease' },
  floatIconLeft: { position: 'absolute', top: '28%', left: -10, animation: 'float-icon 2.8s ease-in-out infinite' },
  floatIconRight: { position: 'absolute', top: '10%', right: -4, animation: 'float-icon 3.2s ease-in-out infinite 0.4s' },
  floatIconBottom: { position: 'absolute', bottom: 4, right: 8, animation: 'float-icon 2.5s ease-in-out infinite 0.8s' },

  matchFoundBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FFF3EE', border: '1.5px solid #F5C4A8', borderRadius: 24, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#C03000', marginTop: 18 },
  liveBlip: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E8430A', animation: 'blink 1.2s ease infinite' },

  matchSection: { padding: '0 14px' },
  matchHeader: { padding: '20px 0 10px' },
  heading: { fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#0D1340', letterSpacing: '-0.3px' },
  subtext: { fontSize: 13, color: '#6B7280', margin: 0 },

  // Discovery disclaimer
  disclaimer: { display: 'flex', gap: 10, background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  disclaimerTitle: { fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 },
  disclaimerGrid: { display: 'flex', flexDirection: 'column', gap: 3 },
  disclaimerYes: { fontSize: 12, color: '#166534', margin: 0 },
  disclaimerNo: { fontSize: 12, color: '#991B1B', margin: 0 },

  // Match card
  matchCard: { background: '#fff', border: '1.5px solid #E8EAF0', borderRadius: 16, padding: '16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(26,35,126,0.06)', position: 'relative', overflow: 'hidden' },
  matchCardRecommended: { border: '2px solid #C03000', boxShadow: '0 4px 16px rgba(192,48,0,0.12)' },
  recommendedBanner: { position: 'absolute', top: 0, right: 0, background: '#C03000', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderBottomLeftRadius: 10, letterSpacing: '0.08em' },
  matchCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  matchTypeTag: { fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.06em' },
  matchTitle: { fontSize: 17, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.2px' },
  matchDesc: { fontSize: 13, color: '#4B5563', margin: '0 0 14px', lineHeight: 1.5 },
  matchFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  seatChipsRow: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1 },
  youChip: { background: '#5C6BC0', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.06em' },
  coachChip: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 },
  optimizedRoute: { display: 'flex', alignItems: 'center', gap: 4, background: '#FFF3EE', border: '1px solid #FDDDD4', borderRadius: 20, padding: '4px 8px' },
  optimizedLabel: { fontSize: 10, fontWeight: 600, color: '#E8430A' },
  ctaBtnNavy: { background: '#1A237E', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(26,35,126,0.3)' },
  ctaBtnOrange: { background: '#C03000', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(192,48,0,0.3)' },
  expandToggle: { background: 'none', border: 'none', color: '#8892B0', fontSize: 12, cursor: 'pointer', marginTop: 12, fontFamily: 'inherit', padding: 0 },

  // Before/after
  beforeAfterWrap: { background: '#F4F5FA', borderRadius: 12, padding: '12px', marginTop: 14, marginBottom: 12 },
  baLabel: { fontSize: 10, fontWeight: 700, color: '#8892B0', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' },
  beforeAfter: { display: 'flex', alignItems: 'center', gap: 8 },
  baBox: { flex: 1 },
  baBoxLabel: { fontSize: 11, color: '#6B7280', margin: '0 0 6px', fontWeight: 500 },
  baSeats: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  baArrow: { flexShrink: 0, color: '#1A237E' },
  seatTag: { display: 'inline-flex', alignItems: 'center', gap: 2, border: '1.5px solid', borderRadius: 8, padding: '3px 7px', fontSize: 11, fontWeight: 600 },
  newBadge: { fontSize: 8, background: '#22C55E', color: '#fff', borderRadius: 4, padding: '1px 3px', marginLeft: 2, fontWeight: 800 },
  summaryLines: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 },
  summaryLine: { fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 },
  nudgePill: { background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#713F12', marginBottom: 10 },
  legalNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5, marginTop: 4, marginBottom: 8 },

  // Coordination card
  coordCard: { background: 'linear-gradient(135deg, #EEF0FF 0%, #E8EAF6 100%)', border: '1.5px solid #C5CAE9', borderRadius: 14, padding: '14px', marginTop: 14, marginBottom: 4 },
  coordTitle: { fontSize: 13, fontWeight: 700, color: '#1A237E', margin: '0 0 12px' },
  matchCodeBox: { background: '#fff', border: '2px dashed #7986CB', borderRadius: 10, padding: '10px 14px', textAlign: 'center', marginBottom: 12 },
  matchCodeLabel: { fontSize: 10, fontWeight: 700, color: '#8892B0', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' },
  matchCodeValue: { fontSize: 28, fontWeight: 800, color: '#1A237E', letterSpacing: '0.18em', fontVariantNumeric: 'tabular-nums' },
  coordSteps: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 },
  coordStep: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  coordStepNum: { width: 22, height: 22, borderRadius: '50%', background: '#1A237E', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  coordStepText: { fontSize: 12, color: '#374151', lineHeight: 1.5, margin: 0 },
  signalBtn: { width: '100%', background: '#1A237E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(26,35,126,0.28)', transition: 'all 0.18s ease' },
  signalBtnSent: { width: '100%', background: '#166534', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'default', fontFamily: 'inherit' },
  coordDisclaimer: { fontSize: 11, color: '#8892B0', textAlign: 'center', marginTop: 8, lineHeight: 1.4 },

  // Urgency banner
  urgencyBanner: { border: '1.5px solid', borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, transition: 'background 0.3s, border-color 0.3s' },
  urgencyLeft: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 },
  urgencyDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3, transition: 'all 0.3s' },
  urgencyTitle: { fontSize: 13, fontWeight: 700, margin: '0 0 2px' },
  urgencyDesc: { fontSize: 11.5, color: '#6B7280', margin: 0, lineHeight: 1.4 },
  urgencyTimer: { display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid', borderRadius: 10, padding: '6px 10px', flexShrink: 0, transition: 'all 0.3s' },
  urgencyTimerLabel: { fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 1, color: '#8892B0' },
  urgencyTimerVal: { fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },

  // Empty state
  emptyCard: { background: '#fff', borderRadius: 16, padding: '20px', margin: '8px 0', boxShadow: '0 2px 8px rgba(26,35,126,0.06)' },
  emptyTitle: { fontSize: 18, fontWeight: 700, textAlign: 'center', margin: '0 0 8px', color: '#0D1340' },
  emptyDesc: { fontSize: 13, color: '#4B5563', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.6 },
  emptySteps: { marginBottom: 14 },
  emptyTip: { background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px' },

  // Tab bar
  tabBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E8EAF0', display: 'flex', zIndex: 10, boxShadow: '0 -2px 12px rgba(26,35,126,0.08)' },
  tabItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px 8px', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit' },
  tabIcon: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabIconActive: { background: '#FFF3EE' },
  tabLabel: { fontSize: 10, letterSpacing: '0.01em' },
};