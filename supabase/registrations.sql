-- One Indore Run registrations: complete setup for a NEW Supabase project.
-- (A project set up with an earlier version needs 002_one_row_per_runner.sql, then
-- 003_kit_checkin_and_admin.sql, instead.)
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Age is not stored: it is worked out from date_of_birth, because race day may still change.

begin;

-- One row per runner per race. A runner who abandons checkout and tries again keeps the same row.
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  reg_no bigint unique,                   -- given only when payment succeeds: 1, 2, 3… without gaps
  created_at timestamptz not null default now(),

  first_name text not null,
  middle_name text,
  last_name text not null,
  mobile text not null,
  email text not null,
  city text not null,
  address text not null,
  pincode text not null,
  date_of_birth date not null,
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
  status text not null default 'pending',
  razorpay_order_id text unique,          -- the order that was paid
  razorpay_payment_id text,
  paid_at timestamptz,

  kit_collected_at timestamptz,           -- set by a volunteer at the expo
  kit_collected_by text,
  admin_notes text,
  updated_at timestamptz,                 -- last edit by an organiser, and who made it
  updated_by text,
  cancelled_at timestamptz,
  cancel_reason text,

  constraint registrations_status_check check (status in ('pending', 'paid', 'failed', 'cancelled'))
);

-- The same runner is: same mobile + race + date of birth + first name (any capitalisation).
-- Siblings sharing a parent's phone differ by name or birth date, so they get their own rows.
create unique index if not exists registrations_one_per_runner
  on public.registrations (mobile, category, date_of_birth, lower(first_name));
create index if not exists registrations_status on public.registrations (status);

-- Every Razorpay order, pointing at its runner, so a payment made in an old checkout window
-- still finds the right registration.
create table if not exists public.payment_orders (
  order_id text primary key,
  registration_id uuid not null references public.registrations (id) on delete cascade,
  amount int not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'duplicate')),
  payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists payment_orders_registration on public.payment_orders (registration_id);

create sequence if not exists public.registration_number_seq;

-- Only the website's server (service-role key) may read or write. No public access.
alter table public.registrations enable row level security;
alter table public.payment_orders enable row level security;

-- Saves a runner's latest details in one step. A repeat attempt by the same runner (same
-- mobile, race, date of birth and first name) updates their unpaid row instead of adding one;
-- a paid row is never changed. Returns that row's id, status and registration number.
create or replace function public.save_pending_registration(p jsonb)
returns table (ticket_id uuid, reg_status text, reg_number bigint)
language plpgsql security definer set search_path = public
as $$
declare
  r public.registrations;
  v_id uuid;
  v_status text;
  v_number bigint;
begin
  r := jsonb_populate_record(null::public.registrations, p);

  insert into public.registrations as t (
    first_name, middle_name, last_name, mobile, email, city, address, pincode, date_of_birth, gender,
    blood_group, occupation, category, tshirt_size, guardian_name, guardian_mobile,
    emergency_name, emergency_mobile, consent_risk, consent_rules, consent_media, amount, status)
  values (
    r.first_name, r.middle_name, r.last_name, r.mobile, r.email, r.city, r.address, r.pincode, r.date_of_birth, r.gender,
    r.blood_group, r.occupation, r.category, r.tshirt_size, r.guardian_name, r.guardian_mobile,
    r.emergency_name, r.emergency_mobile, r.consent_risk, r.consent_rules, r.consent_media, r.amount, 'pending')
  on conflict (mobile, category, date_of_birth, lower(first_name)) do update set
    first_name = excluded.first_name, middle_name = excluded.middle_name, last_name = excluded.last_name,
    email = excluded.email, city = excluded.city, address = excluded.address, pincode = excluded.pincode,
    gender = excluded.gender, blood_group = excluded.blood_group, occupation = excluded.occupation,
    tshirt_size = excluded.tshirt_size, guardian_name = excluded.guardian_name, guardian_mobile = excluded.guardian_mobile,
    emergency_name = excluded.emergency_name, emergency_mobile = excluded.emergency_mobile,
    consent_risk = excluded.consent_risk, consent_rules = excluded.consent_rules, consent_media = excluded.consent_media,
    amount = excluded.amount
  where t.status not in ('paid', 'cancelled')
  returning t.id, t.status, t.reg_no into v_id, v_status, v_number;

  if v_id is null then
    -- Already paid or cancelled: report that row as it is.
    select t.id, t.status, t.reg_no into v_id, v_status, v_number
    from public.registrations t
    where t.mobile = r.mobile and t.category = r.category
      and t.date_of_birth = r.date_of_birth and lower(t.first_name) = lower(r.first_name);
  end if;

  return query select v_id, v_status, v_number;
end;
$$;

-- Records a captured payment in one step. The first payment marks the runner paid and gives
-- them the next registration number. Repeating it (browser + webhook) changes nothing. A second,
-- different payment for an already-paid runner is kept on its order as 'duplicate' for refund.
-- Returns no row for an unknown order.
create or replace function public.mark_order_paid(p_order_id text, p_payment_id text)
returns table (ticket_id uuid, reg_number bigint, race text, outcome text)
language plpgsql security definer set search_path = public
as $$
declare
  v_registration uuid;
  v_paid_with text;
  v_outcome text;
begin
  select o.registration_id into v_registration
  from public.payment_orders o where o.order_id = p_order_id for update;
  if v_registration is null then
    return;
  end if;

  select t.razorpay_payment_id into v_paid_with
  from public.registrations t where t.id = v_registration for update;

  if v_paid_with is null then
    update public.registrations t
    set status = 'paid', razorpay_payment_id = p_payment_id, razorpay_order_id = p_order_id,
        paid_at = now(), reg_no = coalesce(t.reg_no, nextval('public.registration_number_seq'))
    where t.id = v_registration;
    update public.payment_orders o set status = 'paid', payment_id = p_payment_id where o.order_id = p_order_id;
    v_outcome := 'paid';
  elsif v_paid_with = p_payment_id then
    v_outcome := 'already_paid';
  else
    update public.payment_orders o set status = 'duplicate', payment_id = p_payment_id where o.order_id = p_order_id;
    v_outcome := 'duplicate';
  end if;

  return query select t.id, t.reg_no, t.category, v_outcome from public.registrations t where t.id = v_registration;
end;
$$;

-- Only the website's server (service_role) may call these or touch the number sequence.
revoke all on function public.save_pending_registration(jsonb) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.save_pending_registration(jsonb) to service_role;
grant execute on function public.mark_order_paid(text, text) to service_role;
revoke all on sequence public.registration_number_seq from public, anon, authenticated;
grant usage, select on sequence public.registration_number_seq to service_role;

-- Handy view for organisers: confirmed runners only. Export it from Table Editor as CSV.
create or replace view public.paid_registrations
with (security_invoker = true) as
select
  'OIR-' || lpad(reg_no::text, 5, '0') as registration_number,
  first_name, middle_name, last_name, mobile, email, city, date_of_birth, gender, blood_group,
  category, tshirt_size, emergency_name, emergency_mobile, guardian_name, guardian_mobile,
  razorpay_payment_id, paid_at, kit_collected_at, kit_collected_by
from public.registrations
where status = 'paid'
order by reg_no;

-- Second payments by runners who had already paid: refund these from the Razorpay dashboard.
create or replace view public.payments_to_refund
with (security_invoker = true) as
select o.payment_id, o.order_id, o.amount / 100 as amount_inr, o.created_at,
  'OIR-' || lpad(r.reg_no::text, 5, '0') as registration_number, r.first_name, r.last_name, r.mobile
from public.payment_orders o
join public.registrations r on r.id = o.registration_id
where o.status = 'duplicate'
order by o.created_at;

commit;
