-- Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

-- stream_events: one row per authorized stream tick (verified, not settled)
create table public.stream_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null,
  tick_number integer not null,
  amount_usdc text not null,
  cumulative_usdc text not null,
  verified_at timestamptz not null default now(),
  status text not null default 'verified'
    check (status in ('verified', 'failed')),
  payer text not null,
  endpoint text not null default '/api/archer/stream',
  gateway_tx text,
  raw jsonb
);

alter table public.stream_events enable row level security;

create policy "Allow public read access"
  on public.stream_events for select
  using (true);

create policy "Allow service inserts"
  on public.stream_events for insert
  to service_role
  with check (true);

create index stream_events_session_id_idx on public.stream_events (session_id);
create index stream_events_created_at_idx on public.stream_events (created_at desc);
create unique index stream_events_session_tick_uidx
  on public.stream_events (session_id, tick_number);
