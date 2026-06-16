/**
 * CoachMap v3 — Real train coach feel
 * Looks like an actual 3AC coach layout (top-down view)
 * Each bay = 6 berths: LB/MB/UB on left, SL/SU on right side
 */

// 3AC has 8 bays × 6 berths = 48 berths per coach
const generateBays = () => {
  const bays = [];
  for (let bay = 0; bay < 8; bay++) {
    const base = bay * 6;
    bays.push({
      bay: bay + 1,
      main: [
        { num: base + 1, label: 'LB' },
        { num: base + 2, label: 'MB' },
        { num: base + 3, label: 'UB' },
      ],
      side: [
        { num: base + 4, label: 'SL' },
        { num: base + 5, label: 'SU' },
      ],
    });
  }
  return bays;
};

const BAYS = generateBays();

const BERTH_COLORS = {
  yours_target:   { bg: '#22c55e', text: '#fff', border: '#16a34a' },  // green — your seat, correct coach
  yours_stranded: { bg: '#ef4444', text: '#fff', border: '#dc2626' },  // red — your seat, wrong coach
  empty:          { bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0' }, // grey — others
};

export default function CoachMap({ pnrEntries, targetCoach }) {
  const allSeats = [];
  pnrEntries.forEach(entry => {
    if (!entry.data) return;
    entry.data.passengers.filter(p => p.isConfirmed && p.berth).forEach(p => {
      allSeats.push({ coach: p.coach, berth: Number(p.berth), berthType: p.berthType });
    });
  });

  if (allSeats.length === 0) return null;

  // Group by coach
  const byCoach = {};
  allSeats.forEach(s => {
    if (!byCoach[s.coach]) byCoach[s.coach] = [];
    byCoach[s.coach].push(s);
  });

  const coaches = Object.keys(byCoach);
  const effectiveTarget = targetCoach?.toUpperCase() ||
    coaches.reduce((a, b) => byCoach[a].length >= byCoach[b].length ? a : b);

  // Only render coaches that have party seats
  return (
    <div style={S.wrap}>
      <p style={S.sectionTitle}>🚃 Your seats in the coach</p>
      {coaches.map(coach => (
        <TrainCoach
          key={coach}
          coach={coach}
          isTarget={coach === effectiveTarget}
          partySeatNumbers={allSeats.filter(s => s.coach === coach).map(s => s.berth)}
          isStranded={coach !== effectiveTarget}
        />
      ))}
      <Legend />
    </div>
  );
}

function TrainCoach({ coach, isTarget, partySeatNumbers, isStranded }) {
  // Only render bays that are near party seats (±1 bay) to keep it compact
  const partyBayNums = new Set(
    partySeatNumbers.map(b => Math.ceil(b / 6))
  );
  const visibleBays = BAYS.filter(b =>
    partyBayNums.has(b.bay) ||
    partyBayNums.has(b.bay - 1) ||
    partyBayNums.has(b.bay + 1)
  );

  return (
    <div style={S.coachWrap}>
      {/* Coach header — looks like a train nameplate */}
      <div style={{ ...S.coachPlate, background: isTarget ? '#1D9E75' : '#ef4444' }}>
        <span style={S.coachName}>Coach {coach}</span>
        <span style={S.coachStatus}>{isTarget ? '✓ Target' : '✗ Stranded'}</span>
      </div>

      {/* Coach body */}
      <div style={S.coachBody}>
        {/* Left wall */}
        <div style={S.wall} />

        {/* Bays */}
        <div style={S.baysContainer}>
          {/* Corridor label */}
          <div style={S.corridorLabel}>← Corridor →</div>

          {visibleBays.map((bay, i) => (
            <Bay
              key={bay.bay}
              bay={bay}
              partySeatNumbers={partySeatNumbers}
              isStranded={isStranded}
              showEllipsisBefore={i === 0 && bay.bay > 1}
              showEllipsisAfter={i === visibleBays.length - 1 && bay.bay < 8}
            />
          ))}
        </div>

        {/* Right wall */}
        <div style={S.wall} />
      </div>
    </div>
  );
}

function Bay({ bay, partySeatNumbers, isStranded, showEllipsisBefore, showEllipsisAfter }) {
  const getBerthStyle = (num) => {
    if (partySeatNumbers.includes(num)) {
      return isStranded ? BERTH_COLORS.yours_stranded : BERTH_COLORS.yours_target;
    }
    return BERTH_COLORS.empty;
  };

  return (
    <div style={S.bayGroup}>
      {showEllipsisBefore && <div style={S.ellipsis}>• • •</div>}

      <div style={S.bayBox}>
        <div style={S.bayNum}>Bay {bay.bay}</div>

        {/* Main berths: LB / MB / UB stacked */}
        <div style={S.mainSection}>
          {bay.main.map(b => {
            const c = getBerthStyle(b.num);
            const isParty = partySeatNumbers.includes(b.num);
            return (
              <div key={b.num} style={{ ...S.berth, background: c.bg, borderColor: c.border, color: c.text }}>
                <span style={S.berthNum}>{b.num}</span>
                <span style={S.berthLbl}>{b.label}</span>
                {isParty && <span style={S.yourDot}>YOU</span>}
              </div>
            );
          })}
        </div>

        {/* Divider = aisle */}
        <div style={S.aisle} />

        {/* Side berths: SL / SU */}
        <div style={S.sideSection}>
          {bay.side.map(b => {
            const c = getBerthStyle(b.num);
            const isParty = partySeatNumbers.includes(b.num);
            return (
              <div key={b.num} style={{ ...S.berth, ...S.sideBerth, background: c.bg, borderColor: c.border, color: c.text }}>
                <span style={S.berthNum}>{b.num}</span>
                <span style={S.berthLbl}>{b.label}</span>
                {isParty && <span style={S.yourDot}>YOU</span>}
              </div>
            );
          })}
        </div>
      </div>

      {showEllipsisAfter && <div style={S.ellipsis}>• • •</div>}
    </div>
  );
}

function Legend() {
  return (
    <div style={S.legend}>
      <LegendItem bg="#22c55e" border="#16a34a" label="Your seat (correct coach)" />
      <LegendItem bg="#ef4444" border="#dc2626" label="Your seat (needs swap)" />
      <LegendItem bg="#f1f5f9" border="#e2e8f0" label="Other passengers" />
    </div>
  );
}

function LegendItem({ bg, border, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555' }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1.5px solid ${border}` }} />
      {label}
    </div>
  );
}

const S = {
  wrap: { margin: '4px 0 16px' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#334155', margin: '0 0 10px' },

  coachWrap: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8f0' },
  coachPlate: {
    padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  coachName: { fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' },
  coachStatus: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 },

  coachBody: {
    background: '#f8fafc', display: 'flex', alignItems: 'stretch', padding: '10px 0',
  },
  wall: { width: 8, background: '#cbd5e1', flexShrink: 0 },
  baysContainer: { flex: 1, padding: '0 10px', overflowX: 'auto' },
  corridorLabel: {
    fontSize: 10, color: '#94a3b8', textAlign: 'center',
    letterSpacing: '0.08em', marginBottom: 6, fontStyle: 'italic',
  },

  bayGroup: { marginBottom: 6 },
  bayBox: { display: 'flex', alignItems: 'center', gap: 6 },
  bayNum: {
    fontSize: 9, color: '#94a3b8', width: 28, textAlign: 'center',
    lineHeight: 1.2, flexShrink: 0,
  },

  mainSection: { display: 'flex', gap: 4 },
  aisle: { width: 12, borderTop: '2px dashed #cbd5e1', alignSelf: 'center' },
  sideSection: { display: 'flex', gap: 4 },

  berth: {
    width: 48, height: 36, borderRadius: 6, border: '1.5px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', position: 'relative', cursor: 'default',
  },
  sideBerth: { width: 40 },
  berthNum: { fontSize: 11, fontWeight: 700, lineHeight: 1 },
  berthLbl: { fontSize: 8, opacity: 0.75, lineHeight: 1 },
  yourDot: {
    position: 'absolute', top: -6, right: -4,
    background: '#1e40af', color: '#fff',
    fontSize: 7, fontWeight: 800, padding: '1px 3px',
    borderRadius: 4, letterSpacing: '0.03em',
  },

  ellipsis: { fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '4px 0', letterSpacing: '0.2em' },

  legend: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 },
};