-- Upgrade: one row per runner per race, and registration numbers only for paid runners.
-- For databases set up with the first version of registrations.sql.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Runs as one transaction:
-- if any step fails, nothing is changed.

begin;

-- 1. Every Razorpay order gets its own row here, pointing at the runner it belongs to, so a
--    payment made in an old checkout window still finds the right registration.
create table if not exists public.payment_orders (
  order_id text primary key,
  registration_id uuid not null references public.registrations (id) on delete cascade,
  amount int not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'duplicate')),
  payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists payment_orders_registration on public.payment_orders (registration_id);
alter table public.payment_orders enable row level security;

-- 2. Group existing rows by runner (mobile + race + date of birth + first name). The paid row,
--    or else the newest, is kept; the others' orders are re-pointed to it.
create temp table runner_groups on commit drop as
select id, status,
  first_value(id) over (
    partition by mobile, category, date_of_birth, lower(first_name)
    order by (status = 'paid') desc, created_at desc
  ) as keeper
from public.registrations;

insert into public.payment_orders (order_id, registration_id, amount, status, payment_id, created_at)
select r.razorpay_order_id, g.keeper, r.amount,
  case when r.status = 'paid' then 'paid' else 'created' end,
  r.razorpay_payment_id, r.created_at
from public.registrations r
join runner_groups g on g.id = r.id
where r.razorpay_order_id is not null
on conflict (order_id) do nothing;

-- Only unpaid duplicates are removed. If one runner somehow has two paid rows, the unique
-- index below fails and the whole upgrade rolls back, so no paid record is ever deleted.
delete from public.registrations r
using runner_groups g
where g.id = r.id and g.id <> g.keeper and r.status <> 'paid';

create unique index registrations_one_per_runner
  on public.registrations (mobile, category, date_of_birth, lower(first_name));

-- 3. Registration numbers come from a sequence and are handed out only on payment.
alter table public.registrations alter column reg_no drop identity if exists;
alter table public.registrations alter column reg_no drop not null;
update public.registrations set reg_no = null where status <> 'paid';
create sequence if not exists public.registration_number_seq;
select setval('public.registration_number_seq', coalesce((select max(reg_no) from public.registrations), 0) + 1, false);

-- Unpaid registrations stay 'pending'; failed attempts are tracked per order instead.
update public.registrations set status = 'pending' where status = 'failed';

-- 4. Atomic operations used by the website's server.
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
  where t.status <> 'paid'
  returning t.id, t.status, t.reg_no into v_id, v_status, v_number;

  if v_id is null then
    -- Already paid: report the paid row as it is.
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
