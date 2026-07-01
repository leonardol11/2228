-- Store which daily position a rated game was played on

alter table public.games
  add column if not exists position_title text,
  add column if not exists position_date text;
