-- ============================================================
-- access_requests: inbound "request access" submissions from
-- the public landing page. Service-role only. No client reads.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  firm         text not null,
  role         text,
  notes        text,
  ip           text,
  user_agent   text,
  referrer     text,
  status       text not null default 'new',
  handled_at   timestamptz,
  handled_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);
create index if not exists access_requests_email_idx on public.access_requests (lower(email));

alter table public.access_requests enable row level security;

-- No SELECT, INSERT, UPDATE, or DELETE policies for anon/authenticated.
-- Service role bypasses RLS, so the API route can still read/write.
-- Anything not granted is denied.

revoke all on public.access_requests from anon, authenticated;

comment on table public.access_requests is
  'Inbound access-request submissions. Service-role only; no client access.';
