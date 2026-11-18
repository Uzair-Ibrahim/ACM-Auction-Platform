-- Run this in your Supabase SQL Editor to enable full cloud persistence for Vercel:

create table if not exists public.auction_state (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.auction_state enable row level security;

create policy "Allow backend read/write auction_state"
  on public.auction_state
  for all
  using (true)
  with check (true);
