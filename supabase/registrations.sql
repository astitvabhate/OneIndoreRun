-- One Indore Run registrations.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  reg_no bigint generated always as identity unique,
  created_at timestamptz not null default now(),

  first_name text not null,
  middle_name text,
  last_name text not null,
  mobile text not null,
  email text not null,
  city text not null,
  address text not null,
  pincode text not null,
  age int not null check (age between 12 and 100),
  gender text not null,
  blood_group text,
  occupation text,

  category text not null check (category in ('3km', '5km', '10km')),
  tshirt_size text not null check (tshirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),

  guardian_name text,
  guardian_mobile text,
  emergency_name text not null,
  emergency_mobile text not null,

  consent_risk boolean not null,
  consent_rules boolean not null,
  consent_media boolean not null,

  amount int not null,                    -- in paise (₹200 = 20000)
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  paid_at timestamptz
);

create index if not exists registrations_mobile_category on public.registrations (mobile, category);
create index if not exists registrations_status on public.registrations (status);

-- Only the website's server (service-role key) may read or write. No public access.
alter table public.registrations enable row level security;

-- Handy view for organisers: confirmed runners only. Export it from Table Editor as CSV.
create or replace view public.paid_registrations
with (security_invoker = true) as
select
  'OIR-' || lpad(reg_no::text, 5, '0') as registration_number,
  first_name, middle_name, last_name, mobile, email, city, age, gender, blood_group,
  category, tshirt_size, emergency_name, emergency_mobile, guardian_name, guardian_mobile,
  razorpay_payment_id, paid_at
from public.registrations
where status = 'paid'
order by reg_no;
