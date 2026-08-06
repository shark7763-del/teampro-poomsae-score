create table if not exists public.training_display_snapshots (
  session_id text primary key,
  display_id text not null,
  display_code text not null,
  display_name text not null,
  expires_at timestamptz not null,
  sequence integer not null default 0,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists training_display_snapshots_display_code_idx
  on public.training_display_snapshots (display_code, updated_at desc);

alter table public.training_display_snapshots enable row level security;

drop policy if exists "training display snapshots are readable by anon" on public.training_display_snapshots;
create policy "training display snapshots are readable by anon"
  on public.training_display_snapshots
  for select
  to anon
  using (expires_at > now());

drop policy if exists "training display snapshots can be created by anon" on public.training_display_snapshots;
create policy "training display snapshots can be created by anon"
  on public.training_display_snapshots
  for insert
  to anon
  with check (
    expires_at > now()
    and jsonb_typeof(snapshot) = 'object'
    and snapshot ? 'sessionId'
    and snapshot ? 'displayCode'
  );

drop policy if exists "training display snapshots can be updated by anon" on public.training_display_snapshots;
create policy "training display snapshots can be updated by anon"
  on public.training_display_snapshots
  for update
  to anon
  using (expires_at > now())
  with check (
    expires_at > now()
    and jsonb_typeof(snapshot) = 'object'
    and snapshot ? 'sessionId'
    and snapshot ? 'displayCode'
  );

-- Supabase Dashboard requirements:
-- 1. Realtime must be enabled for Broadcast and Presence.
-- 2. Realtime Authorization must allow authenticated anon clients to join private
--    channels named training-display:<sessionId>.
-- 3. Frontend must use only VITE_SUPABASE_ANON_KEY. Never expose service role keys.
