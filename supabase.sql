-- penguintype database. Paste into Supabase > SQL Editor and run once.
-- Accounts are Supabase Auth users with a fake email (<username>@<USER_EMAIL_DOMAIN in account.js>),
-- so "Confirm email" must be OFF in Authentication > Providers > Email.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_.-]{3,20}$'),
  created timestamptz not null default now()
);
create unique index profiles_username on public.profiles (lower(username));

create table public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  lang text not null check (lang in ('python', 'javascript', 'cpp', 'java', 'go', 'rust')),
  mode text not null check (mode in ('time', 'snippet', 'pick', 'zen', 'custom')),
  snippet text not null check (snippet ~ '^[A-Za-z0-9_-]{1,60}$'),
  wpm real not null check (wpm between 0 and 250),
  raw real not null check (raw >= wpm - 0.01 and raw <= 300),
  acc real not null check (acc between 0 and 100),
  seconds real not null check (seconds between 1 and 3600),
  created timestamptz not null default now(),
  -- the leaderboard run type (60s, all content) must really last 60 seconds
  check (snippet <> 'time60-all' or (mode = 'time' and abs(seconds - 60) <= 0.5))
);
create index runs_board on public.runs (lang, snippet, wpm);
create index runs_user on public.runs (user_id, created);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
create policy "usernames are public" on public.profiles for select using (true);
create policy "read own runs" on public.runs for select using (user_id = auth.uid());
-- ponytail: runs come from the browser, so a technical user can fake one; the checks above only stop junk.
-- No per-user insert rate limit; add one (trigger or edge function) if the board gets spammed.
create policy "insert own runs" on public.runs for insert with check (user_id = auth.uid());

-- Create the profile when someone signs up (username comes from signUp options.data).
create function public.new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username) values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.new_user();

-- Best qualifying 60s run per user. Security definer because runs RLS hides other people's runs.
create function public.leaderboard(p_lang text)
returns table (name text, wpm real, raw real, acc real, created timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select distinct on (r.user_id) p.username, r.wpm, r.raw, r.acc, r.created
    from public.runs r join public.profiles p on p.id = r.user_id
    where r.lang = p_lang and r.snippet = 'time60-all' and r.acc >= 75
    order by r.user_id, r.wpm desc
  ) b order by wpm desc limit 50
$$;

-- The signed-in user's best 60s run in a language and its leaderboard rank.
create function public.board_rank(p_lang text)
returns table (rank bigint, best real)
language sql stable security definer set search_path = '' as $$
  with bests as (
    select user_id, max(wpm) as w from public.runs
    where lang = p_lang and snippet = 'time60-all' and acc >= 75 group by user_id
  )
  select (select count(*) + 1 from bests where w > me.w), me.w from bests me where me.user_id = auth.uid()
$$;

-- Everything the profile panel shows, for the signed-in user (RLS keeps it to their own runs).
create function public.my_profile() returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'totals', (select json_build_object('tests', count(*), 'seconds', coalesce(sum(seconds), 0))
               from public.runs where user_id = auth.uid()),
    'perLang', (select coalesce(json_agg(t order by t.tests desc), '[]') from (
                  select lang, count(*) as tests, avg(wpm) as avg, max(wpm) as best,
                         max(wpm) filter (where snippet = 'time60-all') as best60
                  from public.runs where user_id = auth.uid() group by lang) t),
    'recent', (select coalesce(json_agg(t), '[]') from (
                 select lang, mode, snippet, wpm, acc, seconds, created from public.runs
                 where user_id = auth.uid() order by created desc limit 25) t),
    'pbs', (select coalesce(json_agg(t), '[]') from (
              select distinct on (snippet, lang) snippet, lang, wpm, acc from public.runs
              where user_id = auth.uid() order by snippet, lang, wpm desc) t)
  )
$$;

-- ===== update 2026-11-17: daily challenge + build mode =====
-- If you already ran everything above, run only from here down.
alter table public.runs drop constraint runs_mode_check;
alter table public.runs add constraint runs_mode_check
  check (mode in ('time', 'snippet', 'pick', 'zen', 'custom', 'daily', 'build'));
-- A daily run only counts on its own (UTC) day.
-- ponytail: a test started just before midnight UTC and finished after it gets rejected.
alter table public.runs add constraint runs_daily_today
  check (mode <> 'daily' or snippet = 'daily-' || to_char(created at time zone 'utc', 'YYYY-MM-DD'));

drop function public.leaderboard(text);
drop function public.board_rank(text);

-- Best qualifying run per user for one board: 'time60-all' or 'daily-YYYY-MM-DD'.
create function public.leaderboard(p_lang text, p_snippet text default 'time60-all')
returns table (name text, wpm real, raw real, acc real, created timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select distinct on (r.user_id) p.username, r.wpm, r.raw, r.acc, r.created
    from public.runs r join public.profiles p on p.id = r.user_id
    where r.lang = p_lang and r.snippet = p_snippet and r.acc >= 75
    order by r.user_id, r.wpm desc
  ) b order by wpm desc limit 50
$$;

create function public.board_rank(p_lang text, p_snippet text default 'time60-all')
returns table (rank bigint, best real)
language sql stable security definer set search_path = '' as $$
  with bests as (
    select user_id, max(wpm) as w from public.runs
    where lang = p_lang and snippet = p_snippet and acc >= 75 group by user_id
  )
  select (select count(*) + 1 from bests where w > me.w), me.w from bests me where me.user_id = auth.uid()
$$;
