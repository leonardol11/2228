-- Multiplayer: matchmaking queue + live games synced over Supabase Realtime.
-- Run in Supabase SQL Editor after 006_game_position.sql. Safe to re-run.

-- ── Matchmaking queue ────────────────────────────────────────────────────────

create table if not exists public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null,
  rating integer not null,
  rating_deviation double precision not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  game_id uuid
);

alter table public.matchmaking_queue enable row level security;

drop policy if exists "Users can view own queue row" on public.matchmaking_queue;

create policy "Users can view own queue row"
  on public.matchmaking_queue
  for select
  using (auth.uid() = user_id);

grant select on public.matchmaking_queue to authenticated;

-- ── Live games ───────────────────────────────────────────────────────────────

create table if not exists public.live_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references public.profiles (id) on delete cascade,
  black_id uuid not null references public.profiles (id) on delete cascade,
  white_username text not null,
  black_username text not null,
  white_rating integer not null,
  black_rating integer not null,
  white_rd double precision not null,
  black_rd double precision not null,
  start_fen text not null,
  fen text not null,
  moves text not null default '',
  turn text not null check (turn in ('w', 'b')),
  initial_ms integer not null,
  increment_ms integer not null,
  white_ms integer not null,
  black_ms integer not null,
  last_move_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'finished')),
  winner text check (winner in ('w', 'b')),
  end_reason text,
  position_title text,
  position_date text,
  created_at timestamptz not null default now()
);

alter table public.live_games enable row level security;

drop policy if exists "Players can view own live games" on public.live_games;

create policy "Players can view own live games"
  on public.live_games
  for select
  using (auth.uid() in (white_id, black_id));

grant select on public.live_games to authenticated;

-- ── Matchmaking RPC ──────────────────────────────────────────────────────────
-- Called on join and then every few seconds while waiting. Returns the game id
-- once matched, or null while still waiting. Pairs the two closest-rated
-- waiting players; the allowed rating gap widens the longer either has waited.

create or replace function public.join_matchmaking(
  p_start_fen text,
  p_turn text,
  p_initial_ms integer,
  p_increment_ms integer,
  p_position_title text,
  p_position_date text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_profile record;
  my_row record;
  my_wait_seconds double precision := 0;
  opponent record;
  new_game_id uuid;
  me_is_white boolean;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if p_turn not in ('w', 'b') then
    raise exception 'invalid turn';
  end if;

  -- Drop entries whose client stopped polling.
  delete from matchmaking_queue
  where game_id is null
    and last_seen < now() - interval '30 seconds';

  -- Lock our own row first so concurrent matchers can't grab us mid-poll.
  select * into my_row
  from matchmaking_queue
  where user_id = me
  for update;

  if found and my_row.game_id is not null then
    new_game_id := my_row.game_id;
    delete from matchmaking_queue where user_id = me;
    return new_game_id;
  end if;

  if found then
    my_wait_seconds := extract(epoch from (now() - my_row.joined_at));
  end if;

  select id, username, rating, rating_deviation
  into my_profile
  from profiles
  where id = me;

  if not found then
    raise exception 'profile not found';
  end if;

  select * into opponent
  from matchmaking_queue
  where user_id <> me
    and game_id is null
    and last_seen > now() - interval '30 seconds'
    and abs(rating - my_profile.rating) <=
      300 + 15 * greatest(my_wait_seconds, extract(epoch from (now() - joined_at)))
  order by abs(rating - my_profile.rating), joined_at
  limit 1
  for update skip locked;

  if found then
    me_is_white := (random() < 0.5);

    insert into live_games (
      white_id, black_id,
      white_username, black_username,
      white_rating, black_rating,
      white_rd, black_rd,
      start_fen, fen, turn,
      initial_ms, increment_ms, white_ms, black_ms,
      position_title, position_date
    )
    values (
      case when me_is_white then me else opponent.user_id end,
      case when me_is_white then opponent.user_id else me end,
      case when me_is_white then my_profile.username else opponent.username end,
      case when me_is_white then opponent.username else my_profile.username end,
      case when me_is_white then my_profile.rating else opponent.rating end,
      case when me_is_white then opponent.rating else my_profile.rating end,
      case when me_is_white then my_profile.rating_deviation else opponent.rating_deviation end,
      case when me_is_white then opponent.rating_deviation else my_profile.rating_deviation end,
      p_start_fen, p_start_fen, p_turn,
      p_initial_ms, p_increment_ms, p_initial_ms, p_initial_ms,
      p_position_title, p_position_date
    )
    returning id into new_game_id;

    -- Tell the waiting player (they get this via Realtime or their next poll).
    update matchmaking_queue
    set game_id = new_game_id
    where user_id = opponent.user_id;

    delete from matchmaking_queue where user_id = me;

    return new_game_id;
  end if;

  insert into matchmaking_queue (user_id, username, rating, rating_deviation)
  values (me, my_profile.username, my_profile.rating, my_profile.rating_deviation)
  on conflict (user_id) do update set last_seen = now();

  return null;
end;
$$;

grant execute on function public.join_matchmaking(text, text, integer, integer, text, text) to authenticated;

-- Returns the game id if we were matched in the same instant we cancelled.
create or replace function public.leave_matchmaking()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from matchmaking_queue
  where user_id = auth.uid()
  returning game_id into matched_game_id;

  return matched_game_id;
end;
$$;

grant execute on function public.leave_matchmaking() to authenticated;

-- ── Move RPC ─────────────────────────────────────────────────────────────────
-- Legality is validated by both clients with chess.js; the server enforces
-- turn order, participation, and the clocks.

create or replace function public.make_live_move(
  p_game_id uuid,
  p_move text,
  p_fen text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g record;
  mover_color text;
  elapsed_ms integer;
  remaining_ms integer;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  select * into g
  from live_games
  where id = p_game_id
  for update;

  if not found or g.status <> 'active' then
    raise exception 'game not active';
  end if;

  if me = g.white_id then
    mover_color := 'w';
  elsif me = g.black_id then
    mover_color := 'b';
  else
    raise exception 'not a player in this game';
  end if;

  if g.turn <> mover_color then
    raise exception 'not your turn';
  end if;

  elapsed_ms := (extract(epoch from (now() - g.last_move_at)) * 1000)::integer;
  remaining_ms := (case when mover_color = 'w' then g.white_ms else g.black_ms end) - elapsed_ms;

  if remaining_ms <= 0 then
    update live_games
    set status = 'finished',
        winner = case when mover_color = 'w' then 'b' else 'w' end,
        end_reason = 'Time forfeit',
        white_ms = case when mover_color = 'w' then 0 else white_ms end,
        black_ms = case when mover_color = 'b' then 0 else black_ms end
    where id = p_game_id;
    return;
  end if;

  remaining_ms := remaining_ms + g.increment_ms;

  update live_games
  set moves = case when moves = '' then p_move else moves || ' ' || p_move end,
      fen = p_fen,
      turn = case when mover_color = 'w' then 'b' else 'w' end,
      white_ms = case when mover_color = 'w' then remaining_ms else white_ms end,
      black_ms = case when mover_color = 'b' then remaining_ms else black_ms end,
      last_move_at = now()
  where id = p_game_id;
end;
$$;

grant execute on function public.make_live_move(uuid, text, text) to authenticated;

-- ── Game end RPCs ────────────────────────────────────────────────────────────

-- For checkmate, stalemate, resignation, and agreed draws (winner null = draw).
create or replace function public.finish_live_game(
  p_game_id uuid,
  p_winner text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if p_winner is not null and p_winner not in ('w', 'b') then
    raise exception 'invalid winner';
  end if;

  update live_games
  set status = 'finished',
      winner = p_winner,
      end_reason = p_reason
  where id = p_game_id
    and status = 'active'
    and me in (white_id, black_id);
end;
$$;

grant execute on function public.finish_live_game(uuid, text, text) to authenticated;

-- Timeout claims are verified against the server clock.
create or replace function public.claim_timeout(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g record;
  remaining_ms integer;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  select * into g
  from live_games
  where id = p_game_id
  for update;

  if not found or g.status <> 'active' or me not in (g.white_id, g.black_id) then
    return;
  end if;

  remaining_ms := (case when g.turn = 'w' then g.white_ms else g.black_ms end)
    - (extract(epoch from (now() - g.last_move_at)) * 1000)::integer;

  if remaining_ms > 0 then
    return;
  end if;

  update live_games
  set status = 'finished',
      winner = case when g.turn = 'w' then 'b' else 'w' end,
      end_reason = 'Time forfeit',
      white_ms = case when g.turn = 'w' then 0 else white_ms end,
      black_ms = case when g.turn = 'b' then 0 else black_ms end
  where id = p_game_id;
end;
$$;

grant execute on function public.claim_timeout(uuid) to authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.matchmaking_queue;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.live_games;
exception
  when duplicate_object then null;
end;
$$;
