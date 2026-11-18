-- Coders Cup Live Auction Platform — Supabase Cloud Schema

create table if not exists public.auction_state (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.auction_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'auction_state'
      and policyname = 'Allow backend read/write auction_state'
  ) then
    create policy "Allow backend read/write auction_state"
      on public.auction_state
      for all
      using (true)
      with check (true);
  end if;
end
$$;
