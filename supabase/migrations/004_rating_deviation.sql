-- Glicko-style rating deviation for provisional rating swings (Lichess-inspired)

alter table public.profiles
  add column if not exists rating_deviation double precision not null default 350;

alter table public.profiles
  drop constraint if exists profiles_rating_deviation_range;

alter table public.profiles
  add constraint profiles_rating_deviation_range
  check (rating_deviation between 50 and 500);

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
  starting_rd double precision;
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

  starting_rd := case selected_skill_level
    when 'beginner' then 450
    when 'advanced' then 250
    else 350
  end;

  insert into public.profiles (id, first_name, last_name, username, skill_level, rating, rating_deviation)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    normalized_username,
    selected_skill_level,
    starting_rating,
    starting_rd
  );

  return new;
end;
$$;
