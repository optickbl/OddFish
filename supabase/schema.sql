-- ════════════════════════════════════════════════════════════════════
-- Oddfish online play — Supabase / Postgres schema
--
-- Apply once in the Supabase SQL editor, then run seed.sql
-- (generate it with `npm run seed:sql`). Then set VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY for the build. See README "Online play".
--
-- Everything that decides a score happens here, never on the client:
-- answer validation, the 20-second deadline, rarity from real answer
-- frequencies (per question, per day), weights and the Captain's Wager.
-- Players can only read their own submissions; everything else is
-- reached through the functions below, which return aggregates only.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists unaccent;
create extension if not exists fuzzystrmatch;

-- ── Content ──────────────────────────────────────────────────────────
create table if not exists public.questions (
  id text primary key,
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  text text not null
);

create table if not exists public.answers (
  question_id text not null references public.questions (id) on delete cascade,
  answer_id text not null,
  name text not null,
  est numeric not null,               -- curated provisional estimate, percent
  primary key (question_id, answer_id)
);

create table if not exists public.aliases (
  question_id text not null,
  key text not null,                  -- normalised alias
  compact text not null,              -- same without spaces
  answer_id text not null,
  primary key (question_id, key),
  foreign key (question_id, answer_id) references public.answers (question_id, answer_id) on delete cascade
);
create index if not exists aliases_compact on public.aliases (question_id, compact);

create table if not exists public.schedule (
  day int not null,
  position smallint not null,
  question_id text not null references public.questions (id),
  primary key (day, position)
);
create unique index if not exists schedule_q on public.schedule (day, question_id);

-- Central, editable configuration.
create table if not exists public.settings (key text primary key, value numeric not null);
insert into public.settings (key, value) values
  ('min_sample', 200), ('t_sardine', 30), ('t_clownfish', 10), ('t_octopus', 3), ('t_swordfish', 1),
  ('seconds', 20), ('grace_ms', 600), ('wager_multiplier', 2)
on conflict (key) do nothing;

-- ── Players ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 24),
  show_on_leaderboard boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.question_starts (
  user_id uuid not null references auth.users on delete cascade,
  day int not null,
  question_id text not null,
  started_at timestamptz not null default now(),
  primary key (user_id, day, question_id)
);

create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  day int not null,
  question_id text not null,
  input text not null,
  answer_id text,
  tier text not null,
  base_kg int not null,
  kg int not null,                    -- stored at catch time; never recomputed
  wager boolean not null default false,
  pct numeric,
  source text,
  sample int,
  timed_out boolean not null,
  seconds_left numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, day, question_id)  -- one answer per question: idempotent
);
create unique index if not exists one_wager_per_day on public.submissions (user_id, day) where wager;
create index if not exists submissions_user_time on public.submissions (user_id, created_at desc);

-- Aggregates (the only player data anyone else can see, via functions).
create table if not exists public.answer_counts (
  day int not null, question_id text not null, answer_id text not null, n int not null default 0,
  primary key (day, question_id, answer_id)
);
create table if not exists public.question_totals (
  day int not null, question_id text not null, total int not null default 0,
  primary key (day, question_id)
);

-- ── Row level security ───────────────────────────────────────────────
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.aliases enable row level security;
alter table public.schedule enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.question_starts enable row level security;
alter table public.submissions enable row level security;
alter table public.answer_counts enable row level security;
alter table public.question_totals enable row level security;

-- Answers stay hidden. Players read and edit only their own rows.
drop policy if exists own_submissions on public.submissions;
create policy own_submissions on public.submissions for select using (auth.uid() = user_id);
drop policy if exists own_profile_read on public.profiles;
create policy own_profile_read on public.profiles for select using (auth.uid() = user_id);
drop policy if exists own_profile_write on public.profiles;
create policy own_profile_write on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists own_profile_update on public.profiles;
create policy own_profile_update on public.profiles for update using (auth.uid() = user_id);

-- ── Helpers ──────────────────────────────────────────────────────────
create or replace function public.oddfish_setting(k text) returns numeric
language sql stable security definer set search_path = public as $$
  select value from settings where key = k
$$;

-- Daily Cast number: everyone resets at 00:00 UTC. Day 1 = 2026-11-25.
create or replace function public.oddfish_day() returns int
language sql stable as $$
  select ((now() at time zone 'utc')::date - date '2026-11-25') + 1
$$;

-- Must match normalize() in src/core/answers.ts.
create or replace function public.oddfish_normalize(t text) returns text
language sql stable as $$
  select regexp_replace(
    trim(regexp_replace(
      regexp_replace(
        regexp_replace(
            replace(lower(unaccent(translate(coalesce(t, ''), 'łŁøØđĐı', 'lLoOdDi'))), '&', ' and '),
          '[.''’‘`´]', '', 'g'),
        '[-_/,;:]', ' ', 'g'),
      '[^a-z0-9 ]', '', 'g')),
    '\s+', ' ', 'g')
$$;

-- Deterministic matching: exact alias (with simple plurals), then a small typo allowance.
-- A typo equally close to two different answers is rejected.
create or replace function public.oddfish_match(p_question_id text, p_input text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  k text := regexp_replace(oddfish_normalize(p_input), '^the ', '');
  c text;
  v text;
  found text;
  best_d int := 99;
  best text;
  tie boolean := false;
  r record;
begin
  if k = '' then return null; end if;
  foreach v in array array[k,
      case when k like '%ies' then left(k, -3) || 'y' end,
      case when k like '%es' then left(k, -2) end,
      case when k like '%s' then left(k, -1) end] loop
    continue when v is null;
    select answer_id into found from aliases
      where question_id = p_question_id and (key = v or compact = replace(v, ' ', '')) limit 1;
    if found is not null then return found; end if;
  end loop;
  c := replace(k, ' ', '');
  if length(c) < 4 then return null; end if;
  for r in
    select answer_id, min(levenshtein(c, compact)) as d, max(length(compact)) as len
    from aliases where question_id = p_question_id and length(compact) >= 5
      and abs(length(compact) - length(c)) <= 2
    group by answer_id
  loop
    if r.d <= (case when r.len >= 9 then 2 else 1 end) then
      if r.d < best_d then best_d := r.d; best := r.answer_id; tie := false;
      elsif r.d = best_d and r.answer_id <> best then tie := true; end if;
    end if;
  end loop;
  if tie then return null; end if;
  return best;
end $$;

create or replace function public.oddfish_tier(pct numeric) returns text
language sql stable security definer set search_path = public as $$
  select case
    when pct >= oddfish_setting('t_sardine') then 'sardine'
    when pct >= oddfish_setting('t_clownfish') then 'clownfish'
    when pct >= oddfish_setting('t_octopus') then 'octopus'
    when pct >= oddfish_setting('t_swordfish') then 'swordfish'
    else 'leviathan' end
$$;

create or replace function public.oddfish_kg(tier text) returns int
language sql immutable as $$
  select case tier when 'sardine' then 1 when 'clownfish' then 5 when 'octopus' then 25
    when 'swordfish' then 100 when 'leviathan' then 500 else 0 end
$$;

-- ── Game API (called by the app) ─────────────────────────────────────
create or replace function public.start_question(p_day int, p_question_id text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); st timestamptz;
begin
  if uid is null then raise exception 'sign in required'; end if;
  if p_day <> oddfish_day() then raise exception 'not today''s cast'; end if;
  if not exists (select 1 from schedule where day = p_day and question_id = p_question_id) then
    raise exception 'question not in today''s cast';
  end if;
  insert into question_starts (user_id, day, question_id) values (uid, p_day, p_question_id)
    on conflict do nothing;
  select started_at into st from question_starts where user_id = uid and day = p_day and question_id = p_question_id;
  return json_build_object('started_at', st);
end $$;

create or replace function public.submit_answer(p_day int, p_question_id text, p_input text, p_wager boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  existing submissions;
  st timestamptz;
  elapsed_ms numeric;
  limit_ms numeric := oddfish_setting('seconds') * 1000;
  timed_out boolean;
  ans text;
  ans_name text;
  wager boolean := coalesce(p_wager, false);
  tot int; cnt int; v_pct numeric; v_source text; v_tier text; v_base int; v_kg int;
  recent int;
  row submissions;
begin
  if uid is null then raise exception 'sign in required'; end if;

  -- Idempotent: a repeated submit returns the stored catch unchanged.
  select * into existing from submissions where user_id = uid and day = p_day and question_id = p_question_id;
  if found then
    return json_build_object('answer_id', existing.answer_id, 'answer_name', (select name from answers a where a.question_id = p_question_id and a.answer_id = existing.answer_id),
      'tier', existing.tier, 'base_kg', existing.base_kg, 'kg', existing.kg, 'wager', existing.wager, 'pct', existing.pct,
      'source', existing.source, 'sample', existing.sample, 'timed_out', existing.timed_out, 'seconds_left', existing.seconds_left);
  end if;

  if p_day <> oddfish_day() then raise exception 'not today''s cast'; end if;
  select count(*) into recent from submissions where user_id = uid and created_at > now() - interval '3 seconds';
  if recent >= 3 then raise exception 'rate limited'; end if;

  select started_at into st from question_starts where user_id = uid and day = p_day and question_id = p_question_id;
  if st is null then raise exception 'question not started'; end if;
  elapsed_ms := extract(epoch from (now() - st)) * 1000;
  timed_out := elapsed_ms > limit_ms + oddfish_setting('grace_ms');

  if not timed_out then ans := oddfish_match(p_question_id, left(coalesce(p_input, ''), 80)); end if;
  if wager and exists (select 1 from submissions where user_id = uid and day = p_day and submissions.wager) then wager := false; end if;

  if ans is null then
    v_tier := 'boot'; v_base := 0; v_kg := 0;
  else
    select name into ans_name from answers where question_id = p_question_id and answer_id = ans;
    insert into question_totals as q (day, question_id, total) values (p_day, p_question_id, 1)
      on conflict (day, question_id) do update set total = q.total + 1 returning total into tot;
    insert into answer_counts as a (day, question_id, answer_id, n) values (p_day, p_question_id, ans, 1)
      on conflict (day, question_id, answer_id) do update set n = a.n + 1 returning n into cnt;
    if tot >= oddfish_setting('min_sample') then
      v_pct := cnt::numeric / tot * 100; v_source := 'players';
    else
      select est into v_pct from answers where question_id = p_question_id and answer_id = ans; v_source := 'estimate';
    end if;
    v_tier := oddfish_tier(v_pct);
    v_base := oddfish_kg(v_tier);
    v_kg := case when wager then v_base * oddfish_setting('wager_multiplier')::int else v_base end;
  end if;

  insert into submissions (user_id, day, question_id, input, answer_id, tier, base_kg, kg, wager, pct, source, sample, timed_out, seconds_left)
  values (uid, p_day, p_question_id, left(coalesce(p_input, ''), 80), ans, v_tier, v_base, v_kg, wager, v_pct, v_source, tot,
          timed_out or coalesce(trim(p_input), '') = '', greatest(0, (limit_ms - elapsed_ms) / 1000))
  returning * into row;

  return json_build_object('answer_id', ans, 'answer_name', ans_name, 'tier', v_tier, 'base_kg', v_base, 'kg', v_kg,
    'wager', wager, 'pct', v_pct, 'source', v_source, 'sample', tot, 'timed_out', row.timed_out, 'seconds_left', row.seconds_left);
end $$;

-- Aggregated answer statistics for a finished day (never today's, so nobody can peek).
create or replace function public.question_stats(p_day int, p_question_id text) returns json
language sql stable security definer set search_path = public as $$
  select case when p_day >= oddfish_day() then null else json_build_object(
    'total', coalesce((select total from question_totals where day = p_day and question_id = p_question_id), 0),
    'counts', coalesce((select json_object_agg(answer_id, n) from answer_counts where day = p_day and question_id = p_question_id), '{}'::json))
  end
$$;

-- Daily leaderboard: opt-in display names only, no emails or ids.
create or replace function public.daily_leaderboard(p_day int, p_limit int default 50) returns table (rank bigint, name text, kg bigint)
language sql stable security definer set search_path = public as $$
  select rank() over (order by sum(s.kg) desc), coalesce(p.display_name, 'Angler'), sum(s.kg)
  from submissions s join profiles p on p.user_id = s.user_id and p.show_on_leaderboard
  where s.day = p_day
  group by s.user_id, p.display_name
  having count(*) = 7
  order by 3 desc
  limit least(p_limit, 100)
$$;

revoke all on function public.oddfish_match(text, text) from public, anon;
grant execute on function public.start_question(int, text) to authenticated;
grant execute on function public.submit_answer(int, text, text, boolean) to authenticated;
grant execute on function public.question_stats(int, text) to anon, authenticated;
grant execute on function public.daily_leaderboard(int, int) to anon, authenticated;
