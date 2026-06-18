-- scout_decisions: Scout buy/decline choices (not payments — see payment_events for settled USDC)
create table public.scout_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null,
  action text not null check (action in ('buy', 'decline')),
  endpoint text not null,
  reason text not null,
  confidence numeric not null,
  price_usdc text not null,
  payer text
);

alter table public.scout_decisions enable row level security;

create policy "Allow public read access"
  on public.scout_decisions for select
  using (true);

create policy "Allow service inserts"
  on public.scout_decisions for insert
  to service_role
  with check (true);

create index scout_decisions_run_id_idx on public.scout_decisions (run_id);
create index scout_decisions_created_at_idx on public.scout_decisions (created_at desc);
