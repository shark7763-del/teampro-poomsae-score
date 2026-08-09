-- ============================================================================
-- P0-4 比賽房間跨裝置同步
--
-- 安全模型（重點，改之前請先讀懂）：
--
--   1. 房號 ABC123 會出現在電視上，本來就不是機密，不能拿它當授權依據。
--   2. Token 才是授權依據，而且 **token 的明文絕不進入任何 anon 讀得到的資料列**。
--      資料庫只存 SHA-256 hash，明文只存在於 Host 產生的 QR 連結裡。
--   3. anon 沒有任何一張表的直接寫入權限。所有寫入都走 security definer 函式，
--      由函式在伺服器端比對 token hash。前端路由擋不住任何人，這一層才擋得住。
--   4. Host 是唯一能寫 snapshot 的角色。裁判與顯示端只能投遞事件。
--
-- 為什麼 Host 當權威而不是資料庫：計分規則（去頭去尾、tie-break）在 TypeScript
-- 的 RuleProfile 裡，重寫一份 SQL 版本必然會兩邊不同步。讓 Host 跑 reducer、
-- 把結果寫回 snapshot，規則就只有一份。
-- ============================================================================

-- ---------------------------------------------------------------- 房間 snapshot
-- 這張表 anon 可讀。裡面的 snapshot 已在前端 sanitizeRoomState() 拿掉 token。
create table if not exists public.competition_rooms (
  room_code text primary key,
  snapshot jsonb not null,
  sequence integer not null default 0,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists competition_rooms_expires_idx
  on public.competition_rooms (expires_at);

-- ------------------------------------------------------------------ token hash
-- anon 對這張表完全沒有權限（連 select 都沒有），只有 security definer 函式讀得到。
create table if not exists public.competition_room_secrets (
  room_code text primary key references public.competition_rooms (room_code) on delete cascade,
  host_token_hash text not null,
  display_token_hash text not null,
  judge_token_hashes jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------- 事件佇列
-- 裁判／顯示端把事件投遞到這裡，Host 讀取後套用 reducer 並寫回 snapshot。
create table if not exists public.competition_room_events (
  id bigserial primary key,
  room_code text not null references public.competition_rooms (room_code) on delete cascade,
  event_id text not null,
  actor_role text not null,
  actor_slot text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_code, event_id)
);

create index if not exists competition_room_events_room_idx
  on public.competition_room_events (room_code, id);

-- ============================================================================
-- RLS：預設全關，只開必要的讀取
-- ============================================================================

alter table public.competition_rooms enable row level security;
alter table public.competition_room_secrets enable row level security;
alter table public.competition_room_events enable row level security;

-- anon 只能讀「未過期」的房間 snapshot
drop policy if exists "rooms readable while active" on public.competition_rooms;
create policy "rooms readable while active"
  on public.competition_rooms
  for select
  to anon
  using (expires_at > now());

-- anon 可讀事件（Host 需要拉取；裁判端也靠它確認自己送出的事件已入列）
drop policy if exists "room events readable while active" on public.competition_room_events;
create policy "room events readable while active"
  on public.competition_room_events
  for select
  to anon
  using (
    exists (
      select 1
      from public.competition_rooms room
      where room.room_code = competition_room_events.room_code
        and room.expires_at > now()
    )
  );

-- secrets：不建立任何 policy，等於 anon 完全讀不到、寫不到
revoke all on public.competition_room_secrets from anon;

-- 直接寫入一律禁止，寫入只能走下面的函式
revoke insert, update, delete on public.competition_rooms from anon;
revoke insert, update, delete on public.competition_room_events from anon;
grant select on public.competition_rooms to anon;
grant select on public.competition_room_events to anon;

-- ============================================================================
-- 授權函式
-- ============================================================================

-- 用 Postgres 內建的 sha256()（PG 11+），不依賴 pgcrypto。
-- 重用既有專案時，pgcrypto 可能裝在 public 而不是 extensions schema，
-- 那樣 extensions.digest() 會找不到；內建函式沒有這個問題。
create or replace function public.hash_room_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(pg_catalog.sha256(p_token::bytea), 'hex');
$$;

/**
 * 驗證 actor 身分。
 * JUDGE 必須同時對得上 slot 與該 slot 的 token —— 這是「不能冒充其他裁判」的實作點。
 */
create or replace function public.verify_room_actor(
  p_room_code text,
  p_role text,
  p_slot text,
  p_token text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret public.competition_room_secrets%rowtype;
  v_hash text;
begin
  if p_token is null or length(p_token) = 0 then
    return false;
  end if;

  select * into v_secret
  from public.competition_room_secrets
  where room_code = p_room_code;

  if not found then
    return false;
  end if;

  v_hash := public.hash_room_token(p_token);

  if p_role = 'HOST' then
    return v_hash = v_secret.host_token_hash;
  elsif p_role = 'DISPLAY' then
    return v_hash = v_secret.display_token_hash;
  elsif p_role = 'JUDGE' then
    if p_slot is null then
      return false;
    end if;
    return v_hash = (v_secret.judge_token_hashes ->> p_slot);
  end if;

  return false;
end;
$$;

-- ============================================================================
-- 寫入函式（anon 只被授予這三個 execute）
-- ============================================================================

/** 建立房間。只有第一次會成功；房號撞到就報錯，讓前端重新產生一個。 */
create or replace function public.create_competition_room(
  p_room_code text,
  p_host_token text,
  p_display_token text,
  p_judge_tokens jsonb,
  p_snapshot jsonb,
  p_ttl_hours integer default 12
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_judge_hashes jsonb;
begin
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'snapshot must be an object';
  end if;

  -- snapshot 不得夾帶 token；前端漏了 sanitize 就在這裡擋下來
  if p_snapshot ? 'tokens' and jsonb_typeof(p_snapshot -> 'tokens') <> 'null' then
    raise exception 'snapshot must not carry tokens';
  end if;

  select jsonb_object_agg(key, public.hash_room_token(value))
  into v_judge_hashes
  from jsonb_each_text(p_judge_tokens);

  insert into public.competition_rooms (room_code, snapshot, sequence, expires_at)
  values (p_room_code, p_snapshot, 0, now() + make_interval(hours => p_ttl_hours));

  insert into public.competition_room_secrets (
    room_code, host_token_hash, display_token_hash, judge_token_hashes
  )
  values (
    p_room_code,
    public.hash_room_token(p_host_token),
    public.hash_room_token(p_display_token),
    coalesce(v_judge_hashes, '{}'::jsonb)
  );
end;
$$;

/**
 * 投遞事件。伺服器在這裡擋掉越權：
 *   - HOST 不能送 SUBMIT_SCORE（不能代替裁判打分）
 *   - JUDGE 只能送 SUBMIT_SCORE，且 score.judgeSlot 必須等於自己的 slot
 *   - DISPLAY 什麼都不能送
 * event_id 有 unique 限制，重送同一筆不會產生第二列。
 */
create or replace function public.submit_room_event(
  p_room_code text,
  p_role text,
  p_slot text,
  p_token text,
  p_event jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_event ->> 'type';
begin
  if not public.verify_room_actor(p_room_code, p_role, p_slot, p_token) then
    raise exception 'unauthorized actor for room %', p_room_code using errcode = '42501';
  end if;

  if p_role = 'DISPLAY' then
    raise exception 'display is read only' using errcode = '42501';
  end if;

  if p_role = 'HOST' and v_type = 'SUBMIT_SCORE' then
    raise exception 'host cannot submit judge scores' using errcode = '42501';
  end if;

  if p_role = 'JUDGE' then
    if v_type <> 'SUBMIT_SCORE' then
      raise exception 'judges may only submit scores' using errcode = '42501';
    end if;
    if (p_event -> 'score' ->> 'judgeSlot') is distinct from p_slot then
      raise exception 'judge % cannot submit for %', p_slot, p_event -> 'score' ->> 'judgeSlot'
        using errcode = '42501';
    end if;
  end if;

  insert into public.competition_room_events (room_code, event_id, actor_role, actor_slot, payload)
  values (p_room_code, p_event ->> 'eventId', p_role, p_slot, p_event)
  on conflict (room_code, event_id) do nothing;
end;
$$;

/** 寫回 snapshot。只有 Host 可以，且 sequence 必須前進，避免舊畫面覆蓋新結果。 */
create or replace function public.save_room_snapshot(
  p_room_code text,
  p_token text,
  p_snapshot jsonb,
  p_sequence integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.verify_room_actor(p_room_code, 'HOST', null, p_token) then
    raise exception 'only the host may write the snapshot' using errcode = '42501';
  end if;

  if p_snapshot ? 'tokens' and jsonb_typeof(p_snapshot -> 'tokens') <> 'null' then
    raise exception 'snapshot must not carry tokens';
  end if;

  update public.competition_rooms
  set snapshot = p_snapshot,
      sequence = p_sequence,
      updated_at = now()
  where room_code = p_room_code
    and sequence <= p_sequence;
end;
$$;

revoke all on function public.create_competition_room(text, text, text, jsonb, jsonb, integer) from public;
revoke all on function public.submit_room_event(text, text, text, text, jsonb) from public;
revoke all on function public.save_room_snapshot(text, text, jsonb, integer) from public;
revoke all on function public.verify_room_actor(text, text, text, text) from public;

grant execute on function public.create_competition_room(text, text, text, jsonb, jsonb, integer) to anon;
grant execute on function public.submit_room_event(text, text, text, text, jsonb) to anon;
grant execute on function public.save_room_snapshot(text, text, jsonb, integer) to anon;
-- verify_room_actor 不開給 anon：開了等於送一台 token 猜測機

-- ============================================================================
-- Realtime：讓三端收到變更
-- 需要在 Supabase Dashboard → Database → Replication 把這兩張表加入
-- supabase_realtime publication（或直接跑下面兩行）。
-- ============================================================================

alter publication supabase_realtime add table public.competition_rooms;
alter publication supabase_realtime add table public.competition_room_events;

-- ============================================================================
-- 清理：過期房間自己消失，不留下可被翻閱的比賽資料
-- 建議在 Dashboard → Database → Cron 每小時排一次：
--   select public.purge_expired_competition_rooms();
-- ============================================================================

create or replace function public.purge_expired_competition_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.competition_rooms where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
