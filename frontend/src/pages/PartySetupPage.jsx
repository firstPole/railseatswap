/**
 * PartySetupPage v2 — restyled to match RailConnect design system
 * Logic: 100% identical to original. Pure UI/UX changes only.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import { Analytics } from '../lib/analytics.js';
import { useSwapStore } from '../store/index.js';

const MAX_PNRS = 4;

const pickTargetCoach = (pnrEntries) => {
  const counts = {};
  pnrEntries.forEach(e => {
    if (!e.data) return;
    e.data.passengers.filter(p => p.isConfirmed && p.berth).forEach(p => {
      counts[p.coach] = (counts[p.coach] || 0) + 1;
    });
  });
  if (!Object.keys(counts).length) return null;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

const getAllSeats = (pnrEntries) => {
  const seats = [];
  pnrEntries.forEach(e => {
    if (!e.data) return;
    e.data.passengers.filter(p => p.isConfirmed && p.berth).forEach(p => {
      seats.push({ coach: p.coach, berth: p.berth, berthType: p.berthType });
    });
  });
  return seats;
};

export default function PartySetupPage() {
  const navigate = useNavigate();
  const setActiveSwap = useSwapStore(s => s.setActiveSwap);

  const [step, setStep] = useState(1);
  const [pnrs, setPnrs] = useState([{ pnr: '', data: null, loading: false, error: null }]);
  const [goal, setGoal] = useState(null);
  const [preferredBerth, setPreferredBerth] = useState(null);
  const [nudge, setNudge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const confirmedPnrs = pnrs.filter(p => p.data?.passengers?.some(x => x.isConfirmed));
  const allSeats = getAllSeats(pnrs);
  const targetCoach = pickTargetCoach(pnrs);
  const strandedSeats = allSeats.filter(s => s.coach !== targetCoach);
  const alreadyTogether = allSeats.length > 0 && strandedSeats.length === 0;
  const firstTrain = confirmedPnrs[0]?.data;

  const lookupPnr = async (index, pnrValue) => {
    if (pnrValue.length !== 10) return;
    setPnrs(prev => prev.map((p, i) => i === index ? { ...p, loading: true, error: null, data: null } : p));
    try {
      const res = await apiClient.post('/pnr/lookup', { pnr: pnrValue });
      await Analytics.pnrLookup(res.data.trainNumber);
      setPnrs(prev => prev.map((p, i) => i === index ? { ...p, data: res.data, loading: false } : p));
    } catch {
      setPnrs(prev => prev.map((p, i) => i === index
        ? { ...p, error: 'Ticket not found. Please check the PNR number on your ticket.', loading: false }
        : p));
    }
  };

  const updatePnr = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(0, 10);
    setPnrs(prev => prev.map((p, i) => i === index ? { ...p, pnr: clean, data: null, error: null } : p));
    if (clean.length === 10) lookupPnr(index, clean);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.post('/swaps', {
        pnr: confirmedPnrs[0].data.pnr,
        goal,
        preferredBerthType: preferredBerth,
        nudge: nudge ? { description: nudge } : undefined,
      });
      await Analytics.swapCreated(firstTrain?.trainNumber, confirmedPnrs.length);
      console.log('[Swap created]', res.data);
      setActiveSwap(res.data);
      navigate(`/swaps/${res.data.id}/discover`);
    } catch (err) {
      if (err.code === 'ALREADY_TOGETHER') {
        setSubmitError('Great news — all your seats are already in the same coach! No swap needed.');
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .rc-page { font-family: 'DM Sans', sans-serif; background: #ECEEF5; min-height: 100dvh; }
        .rc-input:focus { border-color: #1A237E !important; box-shadow: 0 0 0 3px rgba(26,35,126,0.1); outline: none; }
        .rc-goal-btn:hover { border-color: #1A237E; }
        .rc-cta:hover:not(:disabled) { background: #C73D07 !important; transform: translateY(-1px); }
        .rc-cta { transition: all 0.18s ease !important; }
        .rc-cta:disabled { opacity: 0.6; cursor: not-allowed; }
        .rc-add-btn:hover { border-color: #1A237E; color: #1A237E; background: #f0f2fa; }
        .rc-back:hover { background: #e2e6f0; }
      `}</style>

      <div className="rc-page" style={S.page}>
        {/* Top nav bar */}
        <div style={S.topBar}>
          <div style={S.topBarInner}>
            <div style={S.navBrand}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="#E8EAF6"/>
                <path d="M7 10C7 8.34 8.34 7 10 7H18C19.66 7 21 8.34 21 10V17H7V10Z" fill="#1A237E"/>
                <rect x="9" y="17" width="3" height="3" rx="1" fill="#1A237E"/>
                <rect x="16" y="17" width="3" height="3" rx="1" fill="#1A237E"/>
                <rect x="9.5" y="9.5" width="3.5" height="3" rx="0.75" fill="white"/>
                <rect x="15" y="9.5" width="3.5" height="3" rx="0.75" fill="white"/>
                <rect x="7" y="14" width="14" height="1" fill="#7986CB"/>
                <rect x="5" y="17" width="18" height="1.5" rx="0.75" fill="#3949AB"/>
              </svg>
              <span style={S.navBrandText}>RailConnect</span>
            </div>
            <div style={S.navProfile}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="#E8EAF6"/>
                <circle cx="14" cy="11" r="4" fill="#9FA8DA"/>
                <path d="M6 23c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#9FA8DA"/>
              </svg>
            </div>
          </div>
        </div>

        <div style={S.content}>
          <ProgressBar step={step} total={3} />

          {step === 1 && (
            <StepOne
              pnrs={pnrs} setPnrs={setPnrs} updatePnr={updatePnr}
              confirmedPnrs={confirmedPnrs} allSeats={allSeats}
              targetCoach={targetCoach} strandedSeats={strandedSeats}
              alreadyTogether={alreadyTogether} firstTrain={firstTrain}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepTwo
              goal={goal} setGoal={setGoal}
              preferredBerth={preferredBerth} setPreferredBerth={setPreferredBerth}
              allSeats={allSeats} onBack={() => setStep(1)} onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepThree
              pnrs={pnrs} allSeats={allSeats} targetCoach={targetCoach}
              strandedSeats={strandedSeats} goal={goal} preferredBerth={preferredBerth}
              nudge={nudge} setNudge={setNudge} submitting={submitting}
              submitError={submitError} onBack={() => setStep(2)} onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  const labels = ['Your tickets', 'Your goal', 'Start search'];
  return (
    <div style={S.progressWrap}>
      {[...Array(total)].map((_, i) => (
        <div key={i} style={S.progressStep}>
          <div style={{
            ...S.progressDot,
            background: i < step ? '#1A237E' : '#D0D4E8',
            color: i < step ? '#fff' : '#8892B0',
            boxShadow: i === step - 1 ? '0 0 0 4px rgba(26,35,126,0.15)' : 'none',
          }}>
            {i < step - 1 ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : i + 1}
          </div>
          <span style={{ ...S.progressLabel, color: i === step - 1 ? '#1A237E' : '#8892B0', fontWeight: i === step - 1 ? 600 : 400 }}>
            {labels[i]}
          </span>
          {i < total - 1 && (
            <div style={{ ...S.progressLine, background: i < step - 1 ? '#1A237E' : '#D0D4E8' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
function StepOne({ pnrs, setPnrs, updatePnr, confirmedPnrs, allSeats, targetCoach, strandedSeats, alreadyTogether, firstTrain, onNext }) {
  return (
    <>
      <div style={S.stepHeader}>
        <h1 style={S.title}>Enter your tickets</h1>
        <p style={S.subtitle}>Type the PNR number printed on your train ticket</p>
      </div>

      <div style={S.infoBox}>
        <div style={S.infoIcon}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#E8430A" strokeWidth="1.5"/>
            <path d="M8 7v4M8 5v.5" stroke="#E8430A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={S.infoText}>PNR is the 10-digit number on your ticket or in your SMS from IRCTC</p>
      </div>

      {pnrs.map((entry, i) => (
        <PnrCard key={i} entry={entry} index={i}
          showRemove={i > 0}
          onChange={updatePnr}
          onRemove={() => setPnrs(prev => prev.filter((_, idx) => idx !== i))}
        />
      ))}

      {confirmedPnrs.length > 0 && pnrs.length < MAX_PNRS && (
        <button className="rc-add-btn" style={S.addBtn}
          onClick={() => setPnrs(prev => [...prev, { pnr: '', data: null, loading: false, error: null }])}>
          <span style={S.addBtnPlus}>+</span> Someone else is travelling with me
        </button>
      )}

      {allSeats.length > 0 && (
        <SituationSummary
          allSeats={allSeats} targetCoach={targetCoach}
          strandedSeats={strandedSeats} alreadyTogether={alreadyTogether}
          firstTrain={firstTrain}
        />
      )}

      {confirmedPnrs.length > 0 && (
        <div style={S.bottomAction}>
          <button className="rc-cta" style={S.ctaBtn} onClick={onNext}>
            Continue →
          </button>
        </div>
      )}
    </>
  );
}

// ── PNR card ──────────────────────────────────────────────────────────────────
function PnrCard({ entry, index, showRemove, onChange, onRemove }) {
  const inputRef = useRef();
  useEffect(() => { if (!entry.pnr) inputRef.current?.focus(); }, []);
  const confirmed = entry.data?.passengers?.filter(p => p.isConfirmed) ?? [];

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardLabel}>{index === 0 ? 'Your ticket' : `Ticket ${index + 1}`}</span>
        {showRemove && (
          <button style={S.removeBtn} onClick={onRemove}>Remove</button>
        )}
      </div>

      <input
        ref={inputRef}
        className="rc-input"
        style={{
          ...S.pnrInput,
          borderColor: entry.error ? '#E8430A' : entry.data ? '#22c55e' : '#D0D4E8',
        }}
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="e.g. 4512038761"
        value={entry.pnr}
        onChange={e => onChange(index, e.target.value)}
      />

      {entry.loading && (
        <div style={S.statusRow}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="7" cy="7" r="6" stroke="#1A237E" strokeWidth="2" strokeDasharray="20 18"/>
          </svg>
          <span style={{ fontSize: 13, color: '#5C6BC0' }}>Looking up your ticket…</span>
        </div>
      )}

      {entry.error && (
        <div style={S.errorRow}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="#E8430A" strokeWidth="1.5"/>
            <path d="M7 4v3.5M7 9.5v.5" stroke="#E8430A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: '#C03000' }}>{entry.error}</span>
        </div>
      )}

      {confirmed.length > 0 && (
        <div style={S.ticketResult}>
          <div style={S.ticketResultHeader}>
            <div style={S.ticketFoundBadge}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="6" fill="#166534"/>
                <path d="M3 6l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ticket confirmed
            </div>
            <span style={S.passengerCount}>{confirmed.length} passenger{confirmed.length > 1 ? 's' : ''}</span>
          </div>
          <div style={S.seatList}>
            {confirmed.map((p, j) => (
              <div key={j} style={S.seatItem}>
                <span style={S.seatCoachBadge}>Coach {p.coach}</span>
                <span style={S.seatDivider}>·</span>
                <span style={S.seatNum}>Seat {p.berth}</span>
                <span style={S.seatTypeBadge}>{p.berthType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Situation summary ─────────────────────────────────────────────────────────
function SituationSummary({ allSeats, targetCoach, strandedSeats, alreadyTogether, firstTrain }) {
  if (alreadyTogether) {
    return (
      <div style={{ ...S.summaryCard, borderLeftColor: '#22c55e', background: '#f0fdf4' }}>
        <div style={{ ...S.summaryIconWrap, background: '#dcfce7' }}>
          <span style={{ fontSize: 20 }}>🎉</span>
        </div>
        <div>
          <p style={{ ...S.summaryTitle, color: '#166534' }}>All seats are together!</p>
          <p style={S.summaryDesc}>All {allSeats.length} seats are in the same coach. No swap needed.</p>
        </div>
      </div>
    );
  }

  const strandedCoaches = [...new Set(strandedSeats.map(s => s.coach))];

  return (
    <>
      {/* Family unit detected card — matches screenshot design */}
      <div style={S.familyDetectedCard}>
        <div style={S.familyDetectedHeader}>
          <div style={S.familyDetectedIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M17 20H22V18C22 16.9 21.1 16 20 16C19.1 16 18.4 16.5 18.1 17.2" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M7 20H2V18C2 16.9 2.9 16 4 16C4.9 16 5.6 16.5 5.9 17.2" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="8" r="3" stroke="#1A237E" strokeWidth="1.8"/>
              <path d="M6 20V18C6 15.8 8.7 14 12 14C15.3 14 18 15.8 18 18V20" stroke="#1A237E" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={S.familyDetectedTitle}>Family Unit Detected</span>
        </div>
        <p style={S.familyDetectedDesc}>
          The system has identified {allSeats.length} tickets under the same PNR currently scattered.
          We can attempt to consolidate your group in Coach {targetCoach} by requesting a swap from
          passengers in {strandedCoaches.map(c => `Coach ${c}`).join(' and ')}.
        </p>
        <div style={S.seatPillsRow}>
          {allSeats.map((s, i) => (
            <span key={i} style={{
              ...S.seatPill,
              background: s.coach === targetCoach ? '#E8F5E9' : '#FFEBEE',
              color: s.coach === targetCoach ? '#2E7D32' : '#C62828',
              borderColor: s.coach === targetCoach ? '#A5D6A7' : '#EF9A9A',
            }}>
              {s.coach}·{s.berth}
              <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 2 }}>{s.berthType}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bottom action sheet style — matches screenshot */}
      <div style={S.goalActionSheet}>
        <div style={S.goalActionLeft}>
          <div style={S.goalActionIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
              <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p style={S.goalActionTitle}>Goal: Get all {allSeats.length} family members together?</p>
            <p style={S.goalActionSub}>Optimizing for Coach {targetCoach} availability.</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function StepTwo({ goal, setGoal, preferredBerth, setPreferredBerth, allSeats, onBack, onNext }) {
  const isSolo = allSeats.length === 1;

  const goals = isSolo
    ? [
        { id: 'berth_upgrade', emoji: '⬇️', title: 'I want a lower berth', desc: 'Find someone willing to swap to give you a more comfortable seat' },
        { id: 'open', emoji: '🔄', title: "I'm open to any swap", desc: 'List your seat — others looking to consolidate may offer you a swap' },
      ]
    : [
        { id: 'consolidate', emoji: '👨‍👩‍👧‍👦', title: 'Sit together as a group', desc: 'Find swap so all family members are in the same coach' },
        { id: 'berth_upgrade', emoji: '⬇️', title: 'Get better berths', desc: 'Swap for lower berths or more comfortable seats for elders/children' },
        { id: 'open', emoji: '🔄', title: 'Open to any swap', desc: 'List your seats and let others reach out' },
      ];

  return (
    <>
      <div style={S.stepHeader}>
        <h1 style={S.title}>What do you need?</h1>
        <p style={S.subtitle}>Tell us what would make this journey better</p>
      </div>

      <div style={S.goalCards}>
        {goals.map(g => (
          <button key={g.id} className="rc-goal-btn"
            style={{ ...S.goalCard, ...(goal === g.id ? S.goalCardActive : {}) }}
            onClick={() => setGoal(g.id)}
          >
            <span style={S.goalEmoji}>{g.emoji}</span>
            <div style={S.goalText}>
              <p style={{ ...S.goalTitle, color: goal === g.id ? '#1A237E' : '#111827' }}>{g.title}</p>
              <p style={S.goalDesc}>{g.desc}</p>
            </div>
            <div style={{ ...S.radioCircle, ...(goal === g.id ? S.radioCircleActive : {}) }}>
              {goal === g.id && <div style={S.radioDot} />}
            </div>
          </button>
        ))}
      </div>

      {goal === 'berth_upgrade' && (
        <div style={S.berthSection}>
          <p style={S.berthLabel}>Which berth do you prefer?</p>
          <div style={S.berthOptions}>
            {[
              { id: 'LB', label: 'Lower', desc: 'Most preferred', icon: '🛏️' },
              { id: 'SL', label: 'Side Lower', desc: 'Good option', icon: '🪑' },
              { id: 'MB', label: 'Middle', desc: 'Folds down', icon: '🛌' },
            ].map(b => (
              <button key={b.id}
                style={{ ...S.berthBtn, ...(preferredBerth === b.id ? S.berthBtnActive : {}) }}
                onClick={() => setPreferredBerth(preferredBerth === b.id ? null : b.id)}>
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <span style={{ ...S.berthBtnLabel, color: preferredBerth === b.id ? '#1A237E' : '#111' }}>{b.label}</span>
                <span style={S.berthBtnDesc}>{b.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={S.navRow}>
        <button className="rc-back" style={S.backBtn} onClick={onBack}>← Back</button>
        <button className="rc-cta" style={{ ...S.ctaBtn, flex: 1, opacity: !goal ? 0.5 : 1 }} disabled={!goal} onClick={onNext}>
          Continue →
        </button>
      </div>
    </>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function StepThree({ pnrs, allSeats, targetCoach, strandedSeats, goal, preferredBerth, nudge, setNudge, submitting, submitError, onBack, onSubmit }) {
  const goalLabels = {
    consolidate: '👨‍👩‍👧‍👦 Sit together in one coach',
    berth_upgrade: `⬇️ Get ${preferredBerth ? preferredBerth + ' berth' : 'better berth'}`,
    open: '🔄 Open to any swap',
  };

  return (
    <>
      <div style={S.stepHeader}>
        <h1 style={S.title}>Ready to search</h1>
        <p style={S.subtitle}>We'll watch your train and alert you when someone matches</p>
      </div>

      <div style={S.card}>
        <ReviewRow label="Train" value={`${pnrs.find(p=>p.data)?.data?.trainNumber} · ${pnrs.find(p=>p.data)?.data?.trainName}`} />
        <ReviewRow label="Date" value={pnrs.find(p=>p.data)?.data?.dateOfJourney} />
        <ReviewRow label="Your seats" value={`${allSeats.length} seats across ${[...new Set(allSeats.map(s=>s.coach))].join(', ')}`} />
        <ReviewRow label="Your goal" value={goalLabels[goal]} last />
      </div>

      <div style={S.nudgeCard}>
        <p style={S.nudgeTitle}>🎁 Offer a small thank-you? <span style={S.nudgeOptional}>(optional)</span></p>
        <p style={S.nudgeHint}>People are 3× more likely to agree if you offer something small</p>
        <div style={S.nudgeChips}>
          {['Will buy you chai ☕', 'Will buy you lunch 🍱', 'Happy to help! 🙏'].map(s => (
            <button key={s}
              style={{ ...S.chip, ...(nudge === s ? S.chipActive : {}) }}
              onClick={() => setNudge(nudge === s ? '' : s)}>
              {s}
            </button>
          ))}
        </div>
        <input
          className="rc-input"
          style={{ ...S.inputField, marginTop: 8 }}
          placeholder="Or type your own offer…"
          value={nudge}
          onChange={e => setNudge(e.target.value)}
          maxLength={120}
        />
      </div>

      <div style={S.disclaimerCard}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="7" cy="7" r="6" stroke="#5C6BC0" strokeWidth="1.5"/>
          <path d="M7 5v3.5M7 10v.3" stroke="#5C6BC0" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={S.disclaimerText}>
          SeatSwap shows <strong>possible</strong> swap options only. We do not confirm, guarantee, or execute any seat change. Any swap must be agreed by both passengers. Please inform your TTE after changing seats.
        </p>
      </div>

      {submitError && (
        <div style={S.errorRow}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="#E8430A" strokeWidth="1.5"/>
            <path d="M7 4v3M7 9v.5" stroke="#E8430A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: '#C03000' }}>{submitError}</span>
        </div>
      )}

      <div style={S.navRow}>
        <button className="rc-back" style={S.backBtn} onClick={onBack}>← Back</button>
        <button className="rc-cta"
          style={{ ...S.ctaBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}
          disabled={submitting} onClick={onSubmit}>
          {submitting ? '🔍 Starting radar…' : 'Yes, Create Swap Request'}
        </button>
      </div>
    </>
  );
}

function ReviewRow({ label, value, last }) {
  return (
    <div style={{ ...S.reviewRow, borderBottom: last ? 'none' : '1px solid #ECEEF5' }}>
      <span style={S.reviewLabel}>{label}</span>
      <span style={S.reviewValue}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { paddingBottom: '3rem' },
  topBar: { background: '#fff', borderBottom: '1px solid #E8EAF0', position: 'sticky', top: 0, zIndex: 10 },
  topBarInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', maxWidth: 460, margin: '0 auto' },
  navBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  navBrandText: { fontSize: 17, fontWeight: 700, color: '#1A237E', letterSpacing: '-0.3px' },
  navProfile: { cursor: 'pointer' },

  content: { padding: '20px 16px', maxWidth: 460, margin: '0 auto' },

  // Progress
  progressWrap: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 24, position: 'relative' },
  progressStep: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, position: 'relative' },
  progressDot: { width: 30, height: 30, borderRadius: '50%', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s', zIndex: 1, fontFamily: 'inherit' },
  progressLabel: { fontSize: 10, textAlign: 'center', lineHeight: 1.3 },
  progressLine: { position: 'absolute', top: 15, left: '60%', right: '-40%', height: 2, zIndex: 0, borderRadius: 2 },

  stepHeader: { marginBottom: 18 },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 5px', color: '#0D1340', letterSpacing: '-0.4px' },
  subtitle: { fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 },

  // Info box
  infoBox: { display: 'flex', gap: 8, background: '#FFF3EE', border: '1px solid #FDDDD4', borderRadius: 10, padding: '10px 12px', marginBottom: 14, alignItems: 'flex-start' },
  infoIcon: { flexShrink: 0, marginTop: 1 },
  infoText: { fontSize: 12.5, color: '#8B3A1A', margin: 0, lineHeight: 1.5 },

  // Card
  card: { background: '#fff', border: '1px solid #E8EAF0', borderRadius: 16, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(26,35,126,0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: 700, color: '#8892B0', textTransform: 'uppercase', letterSpacing: '0.08em' },
  removeBtn: { background: 'none', border: 'none', color: '#E8430A', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },

  pnrInput: { width: '100%', border: '2px solid #D0D4E8', borderRadius: 12, padding: '14px 16px', fontSize: 20, fontWeight: 700, color: '#0D1340', background: '#FAFBFF', letterSpacing: '0.1em', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' },

  statusRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 },
  errorRow: { display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, background: '#FFF3EE', border: '1px solid #FDDDD4', borderRadius: 10, padding: '9px 12px' },

  ticketResult: { marginTop: 12, paddingTop: 12, borderTop: '1px solid #ECEEF5' },
  ticketResultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketFoundBadge: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#166534' },
  passengerCount: { fontSize: 12, color: '#8892B0' },
  seatList: { display: 'flex', flexDirection: 'column', gap: 6 },
  seatItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
  seatCoachBadge: { fontWeight: 600, color: '#1A237E', background: '#EEF0FF', padding: '2px 8px', borderRadius: 6, fontSize: 12 },
  seatDivider: { color: '#D0D4E8' },
  seatNum: { fontWeight: 600, color: '#0D1340' },
  seatTypeBadge: { color: '#8892B0', fontSize: 11, background: '#F4F5FA', padding: '1px 6px', borderRadius: 4 },

  addBtn: { width: '100%', background: '#FAFBFF', border: '1.5px dashed #B0B8D8', borderRadius: 12, padding: '14px', fontSize: 14, color: '#5C6BC0', cursor: 'pointer', marginBottom: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s', fontFamily: 'inherit' },
  addBtnPlus: { fontSize: 18, fontWeight: 700, lineHeight: 1 },

  // Situation summary
  summaryCard: { borderLeft: '4px solid', borderRadius: 12, padding: '14px', marginBottom: 14, display: 'flex', gap: 12, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  summaryTitle: { fontSize: 14, fontWeight: 700, margin: '0 0 3px' },
  summaryDesc: { fontSize: 13, color: '#4B5563', margin: 0, lineHeight: 1.5 },

  familyDetectedCard: { background: '#EEF0FA', border: '1px solid #C5CAE9', borderLeft: '4px solid #1A237E', borderRadius: 12, padding: '14px', marginBottom: 12 },
  familyDetectedHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  familyDetectedIcon: { width: 32, height: 32, background: '#E8EAF6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  familyDetectedTitle: { fontSize: 14, fontWeight: 700, color: '#1A237E' },
  familyDetectedDesc: { fontSize: 13, color: '#3949AB', lineHeight: 1.6, margin: '0 0 10px' },

  seatPillsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  seatPill: { fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1.5px solid' },

  goalActionSheet: { background: '#fff', border: '1px solid #E8EAF0', borderRadius: 14, padding: '14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(26,35,126,0.08)' },
  goalActionLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  goalActionIconWrap: { width: 40, height: 40, background: '#E8430A', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalActionTitle: { fontSize: 14, fontWeight: 700, color: '#0D1340', margin: '0 0 2px' },
  goalActionSub: { fontSize: 12, color: '#6B7280', margin: 0 },

  // Goal cards
  goalCards: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 },
  goalCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '2px solid #E8EAF0', borderRadius: 14, padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', fontFamily: 'inherit', width: '100%' },
  goalCardActive: { borderColor: '#1A237E', background: '#F5F6FF', boxShadow: '0 0 0 3px rgba(26,35,126,0.1)' },
  goalEmoji: { fontSize: 26, flexShrink: 0 },
  goalText: { flex: 1 },
  goalTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 3px' },
  goalDesc: { fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4 },
  radioCircle: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #D0D4E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
  radioCircleActive: { borderColor: '#1A237E' },
  radioDot: { width: 10, height: 10, borderRadius: '50%', background: '#1A237E' },

  berthSection: { marginBottom: 20 },
  berthLabel: { fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' },
  berthOptions: { display: 'flex', gap: 8 },
  berthBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: '#fff', border: '2px solid #E8EAF0', borderRadius: 12, padding: '12px 8px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  berthBtnActive: { borderColor: '#1A237E', background: '#F5F6FF' },
  berthBtnLabel: { fontSize: 13, fontWeight: 600 },
  berthBtnDesc: { fontSize: 11, color: '#8892B0' },

  // Review
  reviewRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginLeft: 0 },
  reviewLabel: { fontSize: 12, color: '#8892B0', fontWeight: 500 },
  reviewValue: { fontSize: 13, color: '#0D1340', fontWeight: 600, textAlign: 'right', maxWidth: '60%' },

  nudgeCard: { background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px', marginBottom: 14 },
  nudgeTitle: { fontSize: 14, fontWeight: 700, color: '#78350F', margin: '0 0 4px' },
  nudgeHint: { fontSize: 12, color: '#92400E', margin: '0 0 10px' },
  nudgeOptional: { fontWeight: 400, fontSize: 12, color: '#A16207' },
  nudgeChips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { background: '#fff', border: '1px solid #FDE68A', borderRadius: 20, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#78350F', fontFamily: 'inherit', transition: 'all 0.15s' },
  chipActive: { background: '#F59E0B', borderColor: '#D97706', color: '#fff', fontWeight: 600 },
  inputField: { width: '100%', border: '1.5px solid #E8EAF0', borderRadius: 10, padding: '11px 13px', fontSize: 14, background: '#fff', fontFamily: 'inherit' },

  disclaimerCard: { display: 'flex', gap: 8, background: '#F4F5FA', borderRadius: 10, padding: '11px 14px', marginBottom: 14, alignItems: 'flex-start' },
  disclaimerText: { fontSize: 12, color: '#5C6BC0', margin: 0, lineHeight: 1.6 },

  navRow: { display: 'flex', gap: 10, marginTop: 4 },
  backBtn: { background: '#ECEEF5', border: 'none', borderRadius: 12, padding: '14px 18px', fontSize: 14, color: '#374151', cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s', fontFamily: 'inherit' },

  bottomAction: { marginTop: 8 },
  ctaBtn: { background: '#E8430A', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', boxShadow: '0 4px 14px rgba(232,67,10,0.3)', fontFamily: 'inherit' },
};