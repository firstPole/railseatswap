export default function PrivacyPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Privacy Policy</h1>
      <p style={S.meta}>Effective: July 2025 · SeatSwap</p>

      <Section title="1. Data We Collect">
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Data</th>
              <th style={S.th}>Why</th>
              <th style={S.th}>Retention</th>
            </tr>
          </thead>
          <tbody>
            <Row d="Mobile number" w="Authentication (OTP)" r="Account lifetime" />
            <Row d="PNR number" w="Seat lookup; stored encrypted" r="30 days post-journey" />
            <Row d="Train, date, coach, berth" w="Swap matching" r="30 days post-journey" />
            <Row d="Device type, app version" w="Analytics, product improvement" r="24 months" />
            <Row d="Feature usage events" w="Funnel analysis, service improvement" r="24 months" />
            <Row d="Payment reference ID" w="Fee verification; no card data stored" r="7 years (legal)" />
          </tbody>
        </table>
      </Section>

      <Section title="2. What We Do NOT Collect">
        <ul style={S.list}>
          <li>Passenger names or ages (stripped from PNR data before storage)</li>
          <li>Payment card details (processed entirely by Razorpay)</li>
          <li>Location data or GPS</li>
          <li>Contact list or other app data</li>
        </ul>
      </Section>

      <Section title="3. PNR Privacy & Masking">
        <p>Your full PNR is never shown to other users. Only the last 4 digits are displayed
        (e.g. XXXXXX1234) until a swap is mutually confirmed by all parties. Your name and
        age from the PNR are stripped immediately on lookup and never stored or shared.</p>
      </Section>

      <Section title="4. Data Sharing">
        <p>We may share <strong>anonymised, aggregated</strong> travel pattern data with research
        partners, railway operators, or commercial partners. This data contains no personally
        identifiable information — individual journeys cannot be traced from it.</p>
        <div style={S.highlight}>
          We will never sell your mobile number or individual identity to any third party.
        </div>
      </Section>

      <Section title="5. Analytics & Product Improvement">
        <p>We record how you use the app (screens visited, features used, swap outcomes) to
        improve the product. This telemetry is linked to an internal user ID, not your mobile
        number, and is retained for 24 months.</p>
      </Section>

      <Section title="6. Your Rights">
        <ul style={S.list}>
          <li><strong>Access:</strong> Request a copy of your data via settings.</li>
          <li><strong>Deletion:</strong> Delete your account and all associated data from settings.</li>
          <li><strong>Correction:</strong> Contact us to correct inaccurate information.</li>
        </ul>
        <p style={{ marginTop: 8 }}>Contact: privacy@seatswap.in</p>
      </Section>

      <Section title="7. Security">
        <p>PNR numbers are encrypted at rest. All data is transmitted over TLS. Row-level
        security policies ensure users can only access their own records. We conduct regular
        security reviews.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function Row({ d, w, r }) {
  return (
    <tr>
      <td style={S.td}>{d}</td>
      <td style={S.td}>{w}</td>
      <td style={S.td}>{r}</td>
    </tr>
  );
}

const S = {
  page: { padding: '1.5rem', maxWidth: 640, margin: '0 auto' },
  h1: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#111' },
  meta: { fontSize: 13, color: '#888', margin: '0 0 24px' },
  highlight: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', margin: '10px 0', color: '#166534', lineHeight: 1.6, fontWeight: 500 },
  list: { paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#334155' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', color: '#444' },
};
