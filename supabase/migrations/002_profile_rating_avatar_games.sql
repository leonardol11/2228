-- Run in Supabase SQL Editor after 001_profiles.sql

alter table public.profiles
  add column if not exists rating integer not null default 1200,
  add column if not exists skill_level text not null default 'casual',
  add column if not exists avatar_url text;

alter table public.profiles
  drop constraint if exists profiles_skill_level;

alter table public.profiles
  add constraint profiles_skill_level
  check (skill_level in ('beginner', 'casual', 'advanced'));

alter table public.profiles
  drop constraint if exists profiles_rating_range;

alter table public.profiles
  add constraint profiles_rating_range
  check (rating between 100 and 3000);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  opponent_name text not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  rating_change integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.games enable row level security;

drop policy if exists "Users can view own games" on public.games;

create policy "Users can view own games"
  on public.games
  for select
  using (auth.uid() = user_id);

grant select on public.games to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  selected_skill_level text;
  starting_rating integer;
begin
  normalized_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if normalized_username = '' then
    raise exception 'username is required';
  end if;

  selected_skill_level := coalesce(new.raw_user_meta_data ->> 'skill_level', 'casual');

  if selected_skill_level not in ('beginner', 'casual', 'advanced') then
    selected_skill_level := 'casual';
  end if;

  starting_rating := case selected_skill_level
    when 'beginner' then 400
    when 'advanced' then 1600
    else 1200
  end;

  insert into public.profiles (id, first_name, last_name, username, skill_level, rating)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    normalized_username,
    selected_skill_level,
    starting_rating
  );

  return new;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

create policy "Avatar images are publicly accessible"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatar"
  on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
