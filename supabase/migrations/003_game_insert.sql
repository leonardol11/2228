-- Run in Supabase SQL Editor after 002_profile_rating_avatar_games.sql

drop policy if exists "Users can insert own games" on public.games;

create policy "Users can insert own games"
  on public.games
  for insert
  with check (auth.uid() = user_id);

grant insert on public.games to authenticated;
