# SeatSwap — Indian Railway Seat Discovery Platform

> **Discovery only.** SeatSwap helps passengers find potential seat swap opportunities.
> It does not guarantee, confirm, or execute any seat exchange.

---

## Project Structure

```
seatswap/
├── backend/                        # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js              # Zod-validated env vars (fails fast on startup)
│   │   │   ├── supabase.js         # Admin + user-scoped Supabase clients
│   │   │   └── logger.js           # Winston structured logger
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT verification (Supabase)
│   │   │   └── security.js         # Helmet, CORS, rate limiting, body sanitization
│   │   ├── controllers/
│   │   │   └── swapController.js   # Thin HTTP layer — calls services, sends responses
│   │   ├── routes/
│   │   │   ├── swapRoutes.js       # /api/swaps, /api/pnr
│   │   │   └── paymentRoutes.js    # /api/payments
│   │   ├── services/
│   │   │   ├── pnrService.js       # PNR lookup, validation, passenger masking
│   │   │   ├── paymentService.js   # Razorpay order + verification, fee config
│   │   │   ├── analyticsService.js # Event tracking (fire-and-forget)
│   │   │   ├── tteSlipService.js   # PDF generation (pdfkit)
│   │   │   └── swap/
│   │   │       ├── chainSwapEngine.js  # Core algorithm: 2/3/4-party chain finder
│   │   │       └── swapService.js      # CRUD + orchestration + expiry
│   │   ├── validators/
│   │   │   └── swapValidators.js   # Zod schemas + validate() middleware factory
│   │   ├── utils/
│   │   │   ├── errors.js           # AppError classes + global error handler
│   │   │   └── response.js         # sendSuccess/sendCreated + asyncHandler
│   │   ├── app.js                  # Express app factory (testable, separate from server)
│   │   └── index.js                # Server startup + graceful shutdown
│   ├── .env.example
│   └── package.json
│
├── frontend/                       # React + Vite PWA
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.js         # Anon-key client (never service role)
│   │   │   ├── apiClient.js        # Axios + JWT interceptor + error normalisation
│   │   │   └── analytics.js        # Fire-and-forget event helpers
│   │   ├── store/
│   │   │   └── index.js            # Zustand: auth, swaps, config
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # Phone OTP + consent capture
│   │   │   ├── PartySetupPage.jsx  # Multi-PNR entry + target coach + nudge
│   │   │   ├── DiscoverPage.jsx    # Payment gate + match results + chain cards
│   │   │   ├── TermsPage.jsx       # Terms of Service (discovery-only disclaimer)
│   │   │   └── PrivacyPage.jsx     # Privacy Policy (data table + masking policy)
│   │   ├── App.jsx                 # Router + auth guard + protected routes
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html                  # PWA meta + Razorpay SDK
│   ├── vite.config.js              # Vite + VitePWA plugin
│   ├── .env.example
│   └── package.json
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # All tables, RLS policies, indexes
│
└── README.md
```

---

## Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| Auth | Supabase OTP (phone) | Zero friction, captures phone for analytics, no password management |
| PNR data | indianrailapi.com | No official IRCTC API; this is the standard for Indian rail apps |
| Payment | Razorpay | Best UX for Indian users; supports UPI, cards, wallets |
| Fee toggle | `app_config` table | Toggle paid↔free without redeploy — set `discovery_fee_enabled=false` |
| Chain swap | Custom cycle-finding | No library solves this domain; 2/3/4-party cycles cover 99% of cases |
| PNR privacy | Strip names/ages at lookup | Never stored; only last-4-digits shown until mutual confirmation |
| Analytics | `analytics_events` table | Owned data; queryable via Supabase SQL; sellable as aggregate insights |
| PDF (TTE slip) | pdfkit server-side | Consistent formatting; tamper-evident; no client-side PDF libs needed |

---

## Key Security Properties

1. **No PNR in client** — full PNR only lives in the DB (backend write). Frontend only sends it to `/pnr/lookup` which re-fetches server-side.
2. **Row Level Security** — users can only SELECT active swap requests for their own train; never other users' PNRs.
3. **Rate limiting** — global 100 req/15min + strict 10 req/min on PNR lookup and payment endpoints.
4. **Signature verification** — Razorpay payments verified with HMAC-SHA256 server-side before unlocking matches.
5. **Env validation** — server refuses to start with missing/malformed config (Zod).
6. **Ownership checks** — every mutating DB query includes `.eq('user_id', req.user.id)`.

---

## Monetisation Model

| Mode | Config | Revenue |
|---|---|---|
| Free (launch validation) | `discovery_fee_enabled=false` | Data asset |
| Paid discovery | `discovery_fee_enabled=true`, `discovery_fee_inr=5` | ₹5/swap request |
| Enterprise data licence | Aggregate `analytics_events` | B2B revenue |

Change the fee in Supabase Dashboard → Table Editor → `app_config` → update `discovery_fee_inr`.
No redeploy needed.

---

## Quick Start

```bash
# 1. Supabase
# Create project at supabase.com, run supabase/migrations/001_initial_schema.sql

# 2. Backend
cd backend
cp .env.example .env   # fill in all values
npm install
npm run dev

# 3. Frontend
cd ../frontend
cp .env.example .env   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

---

## Analytics Events Reference

| Event | When | Key Properties |
|---|---|---|
| `auth.otp_sent` | OTP requested | — |
| `auth.login_success` | First login / re-login | — |
| `pnr.lookup` | PNR fetched | `trainNumber` |
| `swap.created` | Swap request posted | `trainNumber`, `seatCount` |
| `swap.match_viewed` | User taps a match | `chainType`, `fitScore` |
| `payment.initiated` | Payment flow opened | `amountInr` |
| `payment.completed` | Payment verified | — |
| `swap.confirmed` | All parties confirmed | `chainType` |
| `discovery.chart_drop_opened` | Flash mode activated | `trainNumber` |

Query example — daily active trains:
```sql
select properties->>'trainNumber' as train, count(distinct user_id) as users
from analytics_events
where event_name = 'swap.created'
  and created_at > now() - interval '7 days'
group by 1 order by 2 desc;
```
