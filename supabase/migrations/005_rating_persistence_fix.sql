-- Run in Supabase SQL Editor if profile rating does not update after games.
-- Safe to re-run (idempotent).

alter table public.profiles
  add column if not exists rating integer not null default 1200,
  add column if not exists skill_level text not null default 'casual',
  add column if not exists rating_deviation double precision not null default 350;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  opponent_name text not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  rating_change integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.games enable row level security;

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can view own games" on public.games;

create policy "Users can view own games"
  on public.games
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own games" on public.games;

create policy "Users can insert own games"
  on public.games
  for insert
  with check (auth.uid() = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert on public.games to authenticated;
