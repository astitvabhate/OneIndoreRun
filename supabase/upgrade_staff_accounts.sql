-- Upgrade for a database set up with an earlier schema.sql: one login per organiser and volunteer,
-- replacing the two shared passwords. Accounts are added with `npm run staff:add` (see staff.example.csv).
-- Safe to run more than once. Run in Supabase: SQL Editor → New query → paste → Run.
-- A fresh setup does not need this: schema.sql already includes it.

begin;

create table if not exists public.staff_users (
  username text primary key check (username ~ '^[a-z0-9._-]{3,32}$'), -- lower case, what they type to sign in
  name text not null check (length(name) between 2 and 40),         -- shown in the activity log, e.g. 'Ravi (volunteer)'
  role text not null check (role in ('admin', 'volunteer')),        -- admin: everything; volunteer: kit check-in only
  password_hash text not null,                                      -- scrypt, never the password itself
  active boolean not null default true,                             -- false signs them out and blocks sign-in
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staff_users enable row level security;

comment on table public.staff_users is 'One login per organiser (admin) and expo volunteer. Passwords are stored as scrypt hashes.';

commit;
