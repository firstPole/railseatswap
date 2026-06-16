-- ============================================================
-- SeatSwap Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Users (extends Supabase auth.users) ──────────────────────
create table public.user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text unique not null,
  display_name  text,
  karma_score   integer default 0,
  swap_count    integer default 0,
  is_verified   boolean default false,
  -- Analytics/monetisation
  device_type   text,
  app_version   text,
  last_active_at timestamptz default now(),
  created_at    timestamptz default now()
);

-- ── Feature flags & pricing config ───────────────────────────
create table public.app_config (
  key    text primary key,
  value  text not null,
  description text
);
insert into public.app_config (key, value, description) values
  ('discovery_fee_inr',  '5',    'Fee in INR to unlock match results (0 = free)'),
  ('discovery_fee_enabled', 'true', 'Toggle: true=paid, false=free'),
  ('max_party_size',     '4',    'Max PNRs in one travel party'),
  ('swap_session_ttl_minutes', '15', 'Minutes before unconfirmed session expires'),
  ('chart_drop_window_hours',  '4',  'Hours before departure for flash mode');

-- ── Swap requests ─────────────────────────────────────────────
create table public.swap_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  pnr                 text not null,            -- encrypted at rest via Supabase Vault in prod
  masked_pnr          text not null,            -- last 4 digits, shown to others
  train_number        text not null,
  train_name          text,
  journey_date        date not null,
  travel_class        text not null,
  boarding_station    text not null,
  destination_station text not null,
  chart_prepared      boolean default false,
  current_coaches     text[]  not null,
  current_berths      integer[] not null,
  berth_types         text[]  not null,
  seat_count          integer not null check (seat_count between 1 and 8),
  target_coach        text not null,
  has_nudge           boolean default false,
  nudge_description   text,
  status              text not null default 'active'
                        check (status in ('active','matched','completed','cancelled','expired')),
  -- Discovery payment
  discovery_paid      boolean default false,
  discovery_order_id  text,
  -- Analytics
  device_type         text,
  source              text,  -- 'organic','whatsapp_share','notification'
  expires_at          timestamptz not null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Swap sessions (multi-party chain confirmation) ────────────
create table public.swap_sessions (
  id           uuid primary key default gen_random_uuid(),
  chain_type   text not null check (chain_type in ('direct','chain_3','chain_4')),
  status       text not null default 'pending'
                 check (status in ('pending','completed','expired','cancelled')),
  fit_score    integer,
  expires_at   timestamptz not null,
  completed_at timestamptz,
  created_at   timestamptz default now()
);

create table public.swap_session_parties (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.swap_sessions(id) on delete cascade,
  swap_request_id  uuid not null references public.swap_requests(id),
  user_id          uuid not null references auth.users(id),
  confirmed        boolean default false,
  confirmed_at     timestamptz,
  assigned_coaches text[],
  assigned_berths  integer[]
);

-- ── Discovery payments ────────────────────────────────────────
create table public.discovery_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  swap_request_id uuid not null references public.swap_requests(id),
  amount_inr      numeric(6,2) not null,
  provider        text default 'razorpay',
  order_id        text,
  payment_id      text,
  status          text default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at      timestamptz default now()
);

-- ── Analytics events ──────────────────────────────────────────
create table public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id),  -- nullable for anonymous
  event_name text not null,
  properties jsonb default '{}',
  session_id text,
  device_type text,
  app_version text,
  created_at  timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index idx_swap_requests_train_date  on public.swap_requests(train_number, journey_date) where status = 'active';
create index idx_swap_requests_user        on public.swap_requests(user_id);
create index idx_analytics_events_name     on public.analytics_events(event_name, created_at);
create index idx_analytics_events_user     on public.analytics_events(user_id, created_at);

-- ── Auto-update updated_at ────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_swap_requests_updated_at
  before update on public.swap_requests
  for each row execute function update_updated_at();

-- ── Row Level Security ────────────────────────────────────────
alter table public.user_profiles       enable row level security;
alter table public.swap_requests       enable row level security;
alter table public.swap_sessions       enable row level security;
alter table public.swap_session_parties enable row level security;
alter table public.discovery_payments  enable row level security;
alter table public.analytics_events    enable row level security;

-- user_profiles: own row only
create policy "users_own_profile" on public.user_profiles
  for all using (auth.uid() = id);

-- swap_requests: own rows + read active rows on same train (for discovery)
create policy "owner_full_access" on public.swap_requests
  for all using (auth.uid() = user_id);
create policy "read_active_same_train" on public.swap_requests
  for select using (
    status = 'active'
    and exists (
      select 1 from public.swap_requests my_req
      where my_req.user_id = auth.uid()
        and my_req.train_number = swap_requests.train_number
        and my_req.journey_date = swap_requests.journey_date
        and my_req.status = 'active'
    )
    -- PNR never exposed; only masked_pnr visible
  );

-- swap_sessions: participants only
create policy "session_participants" on public.swap_sessions
  for select using (
    exists (
      select 1 from public.swap_session_parties p
      where p.session_id = swap_sessions.id and p.user_id = auth.uid()
    )
  );
create policy "session_parties_own" on public.swap_session_parties
  for all using (user_id = auth.uid());

-- payments: own only
create policy "own_payments" on public.discovery_payments
  for all using (auth.uid() = user_id);

-- analytics: insert-only from client (no reads)
create policy "analytics_insert" on public.analytics_events
  for insert with check (true);
