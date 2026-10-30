-- Upgrade for a database set up with an earlier schema.sql: group entries from organisations.
--   • organisations: schools, companies and clubs whose runners are imported from a CSV
--   • registrations.organisation_id: which organisation a runner was imported with
--   • group entries may be free or at a reduced fee, so a payment of ₹0 is allowed
--   • collect_organisation_kits: marks every kit of an organisation collected at once (kits sent to them)
-- Safe to run more than once. Run in Supabase: SQL Editor → New query → paste → Run.
-- A fresh setup does not need this: schema.sql already includes it.

begin;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  contact_name text,
  contact_mobile text,
  created_at timestamptz not null default now()
);
create unique index if not exists organisations_name on public.organisations (lower(name));
alter table public.organisations enable row level security;

alter table public.registrations add column if not exists organisation_id uuid references public.organisations (id) on delete restrict;
create index if not exists registrations_organisation on public.registrations (organisation_id) where organisation_id is not null;

alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount >= 0);

-- Same as before, plus the organisation (new columns go last so the view can be replaced in place).
create or replace view public.registration_details with (security_invoker = true) as
select
  r.id, r.reg_no, r.status, r.race as category, r.tshirt_size, r.consent_media, r.admin_notes,
  r.cancelled_at, r.cancel_reason, r.created_at,
  u.id as runner_id, u.first_name, u.middle_name, u.last_name, u.date_of_birth, u.gender, u.blood_group,
  u.occupation, u.mobile, u.email, u.address, u.city, u.pincode, u.emergency_name, u.emergency_mobile,
  u.guardian_name, u.guardian_mobile, u.search_text,
  p.amount, p.payment_id as razorpay_payment_id, p.paid_at,
  k.collected_at as kit_collected_at, k.collected_by as kit_collected_by,
  r.organisation_id, o.name as organisation
from public.registrations r
join public.runners u on u.id = r.runner_id
left join public.payments p on p.registration_id = r.id and p.status = 'paid'
left join public.kit_collections k on k.registration_id = r.id
left join public.organisations o on o.id = r.organisation_id;

-- One row per organisation with its paid runners, kits handed over and money received.
create or replace view public.organisation_summary with (security_invoker = true) as
select
  o.id, o.name, o.contact_name, o.contact_mobile, o.created_at,
  count(r.id) filter (where r.status = 'paid') as runners,
  count(k.registration_id) filter (where r.status = 'paid') as kits,
  coalesce(sum(p.amount) filter (where r.status = 'paid'), 0) as amount_paise
from public.organisations o
left join public.registrations r on r.organisation_id = o.id
left join public.kit_collections k on k.registration_id = r.id
left join public.payments p on p.registration_id = r.id and p.status = 'paid'
group by o.id;

-- Marks the kit of every paid runner of an organisation as collected, e.g. when the kits are
-- delivered to a school before the expo. Kits already collected are left as they were.
-- Returns how many kits were marked.
create or replace function public.collect_organisation_kits(p_organisation uuid, p_by text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[];
  v_name text;
begin
  select o.name into v_name from public.organisations o where o.id = p_organisation;
  if v_name is null then return 0; end if;

  with added as (
    insert into public.kit_collections (registration_id, collected_by)
    select r.id, p_by from public.registrations r
    where r.organisation_id = p_organisation and r.status = 'paid'
    on conflict do nothing
    returning registration_id
  )
  select array_agg(registration_id) into v_ids from added;
  if v_ids is null then return 0; end if;

  insert into public.audit_log (registration_id, action, actor, details)
  select id, 'kit_collected', p_by, jsonb_build_object('reason', 'Sent to ' || v_name)
  from unnest(v_ids) as id;
  return cardinality(v_ids);
end;
$$;

revoke all on function public.collect_organisation_kits(uuid, text) from public, anon, authenticated;
grant execute on function public.collect_organisation_kits(uuid, text) to service_role;

comment on view public.organisation_summary is 'Read-only: each organisation with its paid runners, kits handed over and money received.';
comment on table public.organisations is 'Schools, companies and clubs whose runners were imported together (Groups in the dashboard).';
comment on column public.registrations.organisation_id is 'The organisation this runner was imported with; empty for runners who registered themselves.';

commit;
