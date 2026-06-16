export default function TermsPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Terms of Service</h1>
      <p style={S.meta}>Effective: July 2025 · SeatSwap</p>

      <Section title="1. Nature of the Service">
        <p>SeatSwap is a <strong>seat swap discovery platform</strong>. We help passengers on Indian Railways
        find other passengers who may be willing to exchange seat assignments.</p>
        <div style={S.highlight}>
          <strong>SeatSwap does not guarantee, facilitate, or confirm any seat exchange.</strong> All seat
          swaps are voluntary agreements between individual passengers. SeatSwap bears no responsibility
          for any swap that does not materialise.
        </div>
      </Section>

      <Section title="2. Passenger Responsibilities">
        <ul style={S.list}>
          <li>You must hold a valid, confirmed ticket for the journey on which you post a swap request.</li>
          <li>You must inform your Train Ticket Examiner (TTE) of any seat change before or immediately after it occurs.</li>
          <li>Physical seat movement is your responsibility. SeatSwap provides a digital coordination tool only.</li>
          <li>Providing false PNR or seat information is prohibited and may result in account termination.</li>
        </ul>
      </Section>

      <Section title="3. Discovery Fee">
        <p>A nominal discovery fee (currently ₹5, subject to change) may be charged to view swap
        match results. This fee covers platform operating costs and is non-refundable once match
        results are displayed, regardless of whether a swap is successfully completed.</p>
        <p>The discovery fee may be set to ₹0 (free) at our discretion during promotional periods.</p>
      </Section>

      <Section title="4. No IRCTC or Railway Affiliation">
        <p>SeatSwap is an independent platform and is <strong>not affiliated with, endorsed by, or
        operated by Indian Railways, IRCTC, or any government body.</strong></p>
      </Section>

      <Section title="5. Limitation of Liability">
        <p>SeatSwap's total liability to any user for any claim arising from use of the platform
        shall not exceed the discovery fee paid for that specific journey, if any.</p>
        <p>We are not liable for: missed trains, disputes between passengers, TTE-related issues,
        or any consequences arising from a seat swap arrangement.</p>
      </Section>

      <Section title="6. Acceptable Use">
        <p>You may not use SeatSwap to: harass other users, post false swap requests, resell seat
        information, or circumvent payment requirements.</p>
      </Section>

      <Section title="7. Changes to Terms">
        <p>We may update these terms at any time. Continued use of the platform constitutes acceptance
        of the updated terms.</p>
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

const S = {
  page: { padding: '1.5rem', maxWidth: 640, margin: '0 auto' },
  h1: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#111' },
  meta: { fontSize: 13, color: '#888', margin: '0 0 24px' },
  highlight: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', margin: '10px 0', color: '#78350f', lineHeight: 1.6 },
  list: { paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
};
