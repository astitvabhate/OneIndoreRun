-- Upgrade: kit check-in at the expo, admin notes and cancelling registrations.
-- For databases that already ran 002_one_row_per_runner.sql.
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to run again.

begin;

alter table public.registrations add column if not exists kit_collected_at timestamptz;
alter table public.registrations add column if not exists kit_collected_by text;
alter table public.registrations add column if not exists admin_notes text;
alter table public.registrations add column if not exists updated_at timestamptz;
alter table public.registrations add column if not exists updated_by text;
alter table public.registrations add column if not exists cancelled_at timestamptz;
alter table public.registrations add column if not exists cancel_reason text;

alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));

-- A cancelled runner who fills the form again is told to contact the organisers (handled by the
-- website), so their cancelled row is left alone here just like a paid one.
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

revoke all on function public.save_pending_registration(jsonb) from public, anon, authenticated;
grant execute on function public.save_pending_registration(jsonb) to service_role;

-- Organisers' list also shows who has collected their kit.
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

commit;

-- Result shown in the SQL Editor: kit_columns should be 2 and cancelled_allowed true.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name in ('kit_collected_at', 'kit_collected_by')) as kit_columns,
  (select pg_get_constraintdef(oid) like '%cancelled%' from pg_constraint where conname = 'registrations_status_check') as cancelled_allowed,
  has_function_privilege('anon', 'public.save_pending_registration(jsonb)', 'execute') as anon_can_call_save;
