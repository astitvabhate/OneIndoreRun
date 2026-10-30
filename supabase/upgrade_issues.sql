-- Upgrade for a database set up with an earlier schema.sql: issues reported by runners.
--   • issues: problems sent from the website's Help page (payment, ticket, details, kit, other),
--     which organisers read and resolve on the Issues page of the dashboard
-- Safe to run more than once. Run in Supabase: SQL Editor → New query → paste → Run.
-- A fresh setup does not need this: schema.sql already includes it.

begin;

create table if not exists public.issues (
  id bigint generated always as identity primary key,   -- the runner's reference number, e.g. #42
  category text not null check (category in ('payment', 'ticket', 'details', 'kit', 'other')),
  name text not null,
  mobile text not null,
  email text,
  reg_no text,                                            -- as the runner typed it, e.g. OIRI-00012
  payment_ref text,                                       -- Razorpay payment ID or UPI reference, if they have one
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text,                                        -- what the organiser did
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists issues_status_created on public.issues (status, created_at desc);
alter table public.issues enable row level security;

comment on table public.issues is 'Problems reported by runners from the Help page, and how organisers resolved them.';

commit;
