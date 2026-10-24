-- One Indore Run database: the complete setup, in one file.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- To start over, run drop_everything.sql first.
--
--   races            the runs on offer (3 KM, 5 KM, 10 KM)
--   runners          one row per person: who they are and how to reach them
--   registrations    one row per runner per race: T-shirt, consents, status, OIR number
--   payments         one row per Razorpay checkout attempt for a registration
--   kit_collections  one row per kit handed over at the expo
--   audit_log        every change made by organisers and volunteers
--   rate_limits      short-lived request counters that slow down bots
--
--   registration_details  read-only view joining the above, used by the dashboard and tickets
--
-- The website's server is the only client (service-role key). Every multi-step change goes
-- through a function below, so it either happens completely or not at all.
-- Age is not stored: it is worked out from date_of_birth, because race day may still change.
-- Unpaid registrations are deleted after 7 days by a nightly job (see nightly_cleanup).

begin;

create extension if not exists pg_trgm with schema extensions;

-- ─── Tables ──────────────────────────────────────────────────────────────────────────────────

create table public.races (
  slug text primary key,
  name text not null,
  sort_order int not null,
  capacity int check (capacity > 0)       -- most paid runners allowed; empty = no limit
);
insert into public.races (slug, name, sort_order) values ('3km', '3 KM', 1), ('5km', '5 KM', 2), ('10km', '10 KM', 3);

create table public.runners (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  gender text not null,
  blood_group text,
  occupation text,
  mobile text not null,
  email text not null,
  address text not null,
  city text not null,
  pincode text not null,
  emergency_name text not null,
  emergency_mobile text not null,
  guardian_name text,                     -- required for under-18s, checked by the website
  guardian_mobile text,
  search_text text generated always as (lower(
    first_name || ' ' || coalesce(middle_name || ' ', '') || last_name || ' ' || mobile || ' ' || email || ' ' || city
  )) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- The same person is: same mobile + date of birth + first name (any capitalisation).
-- Siblings sharing a parent's phone differ by name or birth date, so they are separate runners.
create unique index runners_identity on public.runners (mobile, date_of_birth, lower(first_name));
create index runners_search on public.runners using gin (search_text extensions.gin_trgm_ops);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),   -- also the ticket id in the QR code
  runner_id uuid not null references public.runners (id) on delete restrict,
  race text not null references public.races (slug),
  tshirt_size text not null check (tshirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  reg_no bigint unique,                             -- given when payment succeeds
  consent_risk boolean not null,
  consent_rules boolean not null,
  consent_media boolean not null,
  admin_notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (runner_id, race)                          -- a runner enters each race once
);
create index registrations_status_created on public.registrations (status, created_at desc);
create index registrations_created on public.registrations (created_at desc);
create index registrations_race_paid on public.registrations (race) where status = 'paid';

create table public.payments (
  order_id text primary key,                        -- Razorpay order id
  registration_id uuid not null references public.registrations (id) on delete restrict,
  amount int not null check (amount > 0),           -- in paise (₹200 = 20000)
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refund_due', 'refunded')),
  refund_reason text check (refund_reason in ('duplicate', 'cancelled', 'sold_out')),
  payment_id text unique,                           -- Razorpay payment id, once paid
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index payments_registration on public.payments (registration_id, created_at);
-- A registration is paid by exactly one payment. Money that can't count towards a place
-- (a second payment, a cancelled or sold-out registration) is 'refund_due' until refunded.
create unique index payments_one_paid on public.payments (registration_id) where status = 'paid';
create index payments_refund_due on public.payments (created_at) where status = 'refund_due';

create table public.kit_collections (
  registration_id uuid primary key references public.registrations (id) on delete restrict,
  collected_at timestamptz not null default now(),
  collected_by text not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete restrict, -- empty for sign-ins
  action text not null check (action in ('edited', 'cancelled', 'restored', 'kit_collected', 'kit_undone', 'signed_in')),
  actor text not null,                              -- the signed-in organiser or volunteer, e.g. 'Ravi (volunteer)'
  details jsonb,                                    -- edits: {"changes": {field: {"from": …, "to": …}}}
  created_at timestamptz not null default now()
);
create index audit_log_registration on public.audit_log (registration_id, created_at desc);
create index audit_log_recent on public.audit_log (created_at desc);

-- Request counters for rate limiting (e.g. registrations per IP address per 10 minutes).
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

create sequence public.registration_number_seq;

-- No public access: only the website's server (service-role key, which bypasses these).
alter table public.races enable row level security;
alter table public.runners enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.kit_collections enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

-- ─── Read model ─────────────────────────────────────────────────────────────────────────────

-- One flat row per registration with its runner, paid payment and kit status.
create view public.registration_details with (security_invoker = true) as
select
  r.id, r.reg_no, r.status, r.race as category, r.tshirt_size, r.consent_media, r.admin_notes,
  r.cancelled_at, r.cancel_reason, r.created_at,
  u.id as runner_id, u.first_name, u.middle_name, u.last_name, u.date_of_birth, u.gender, u.blood_group,
  u.occupation, u.mobile, u.email, u.address, u.city, u.pincode, u.emergency_name, u.emergency_mobile,
  u.guardian_name, u.guardian_mobile, u.search_text,
  p.amount, p.payment_id as razorpay_payment_id, p.paid_at,
  k.collected_at as kit_collected_at, k.collected_by as kit_collected_by
from public.registrations r
join public.runners u on u.id = r.runner_id
left join public.payments p on p.registration_id = r.id and p.status = 'paid'
left join public.kit_collections k on k.registration_id = r.id;

-- ─── Checkout ───────────────────────────────────────────────────────────────────────────────

-- True while the race still has places (or has no limit).
create function public.race_has_room(p_race text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select c.capacity > (select count(*) from public.registrations y where y.race = p_race and y.status = 'paid')
     from public.races c where c.slug = p_race and c.capacity is not null),
    true);
$$;

-- Saves a runner's form. A repeat attempt (same person, same race) reuses their rows instead of
-- adding new ones. Someone already paid or cancelled keeps their details as they were.
-- Returns the registration's id, status and number, or status 'full' if the race is sold out.
create function public.save_pending_registration(p jsonb)
returns table (ticket_id uuid, reg_status text, reg_number bigint)
language plpgsql security definer set search_path = public
as $$
declare
  u public.runners := jsonb_populate_record(null::public.runners, p);
  r public.registrations := jsonb_populate_record(null::public.registrations, p);
  v_runner uuid;
begin
  -- A sold-out race takes no new checkouts, but someone already in it still gets their entry back.
  if not public.race_has_room(r.race) then
    select t.id, t.status, t.reg_no into ticket_id, reg_status, reg_number
    from public.registrations t join public.runners s on s.id = t.runner_id
    where t.race = r.race and t.status <> 'pending'
      and s.mobile = u.mobile and s.date_of_birth = u.date_of_birth and lower(s.first_name) = lower(u.first_name);
    reg_status := coalesce(reg_status, 'full');
    return next;
    return;
  end if;

  insert into public.runners as t (
    first_name, middle_name, last_name, date_of_birth, gender, blood_group, occupation, mobile, email,
    address, city, pincode, emergency_name, emergency_mobile, guardian_name, guardian_mobile)
  values (
    u.first_name, u.middle_name, u.last_name, u.date_of_birth, u.gender, u.blood_group, u.occupation, u.mobile, u.email,
    u.address, u.city, u.pincode, u.emergency_name, u.emergency_mobile, u.guardian_name, u.guardian_mobile)
  on conflict (mobile, date_of_birth, lower(first_name)) do update set
    first_name = excluded.first_name, middle_name = excluded.middle_name, last_name = excluded.last_name,
    gender = excluded.gender, blood_group = excluded.blood_group, occupation = excluded.occupation,
    email = excluded.email, address = excluded.address, city = excluded.city, pincode = excluded.pincode,
    emergency_name = excluded.emergency_name, emergency_mobile = excluded.emergency_mobile,
    guardian_name = excluded.guardian_name, guardian_mobile = excluded.guardian_mobile, updated_at = now()
  where not exists (select 1 from public.registrations x where x.runner_id = t.id and x.status <> 'pending')
  returning t.id into v_runner;

  if v_runner is null then
    select t.id into v_runner from public.runners t
    where t.mobile = u.mobile and t.date_of_birth = u.date_of_birth and lower(t.first_name) = lower(u.first_name);
  end if;

  insert into public.registrations as t (runner_id, race, tshirt_size, consent_risk, consent_rules, consent_media)
  values (v_runner, r.race, r.tshirt_size, r.consent_risk, r.consent_rules, r.consent_media)
  on conflict (runner_id, race) do update set
    tshirt_size = excluded.tshirt_size, consent_risk = excluded.consent_risk,
    consent_rules = excluded.consent_rules, consent_media = excluded.consent_media
  where t.status = 'pending'
  returning t.id, t.status, t.reg_no into ticket_id, reg_status, reg_number;

  if ticket_id is null then
    -- Already paid or cancelled: report that registration as it is.
    select t.id, t.status, t.reg_no into ticket_id, reg_status, reg_number
    from public.registrations t where t.runner_id = v_runner and t.race = r.race;
  end if;
  return next;
end;
$$;

-- Records a captured payment. Outcomes:
--   paid          the registration is now paid and has the next number
--   already_paid  this payment was recorded before (browser and webhook both confirm)
--   duplicate     the registration was already paid by another payment: refund this one
--   cancelled     the registration was cancelled by an organiser: refund
--   sold_out      the race filled up while the runner was paying: refund
-- Anything but paid / already_paid leaves the payment 'refund_due'. No row for an unknown order.
create function public.mark_order_paid(p_order_id text, p_payment_id text)
returns table (ticket_id uuid, reg_number bigint, race text, outcome text)
language plpgsql security definer set search_path = public
as $$
declare
  v_registration uuid;
  v_status text;
  v_race text;
  o public.payments;
  v_outcome text;
begin
  select x.registration_id into v_registration from public.payments x where x.order_id = p_order_id;
  if v_registration is null then
    return;
  end if;

  -- Lock the registration (and, for a capped race, the race) so concurrent confirmations queue up.
  select t.status, t.race into v_status, v_race from public.registrations t where t.id = v_registration for update;
  perform 1 from public.races c where c.slug = v_race and c.capacity is not null for update;
  select * into o from public.payments x where x.order_id = p_order_id;

  if o.payment_id = p_payment_id then
    v_outcome := case when o.status = 'paid' then 'already_paid' else coalesce(o.refund_reason, 'already_paid') end;
  else
    v_outcome := case
      when exists (select 1 from public.payments x where x.registration_id = v_registration and x.status = 'paid') then 'duplicate'
      when v_status = 'cancelled' then 'cancelled'
      when not public.race_has_room(v_race) then 'sold_out'
      else 'paid'
    end;
    if v_outcome = 'paid' then
      update public.payments x set status = 'paid', payment_id = p_payment_id, paid_at = now() where x.order_id = p_order_id;
      update public.registrations t
      set status = 'paid', reg_no = coalesce(t.reg_no, nextval('public.registration_number_seq'))
      where t.id = v_registration;
    else
      update public.payments x
      set status = 'refund_due', refund_reason = v_outcome, payment_id = p_payment_id, paid_at = now()
      where x.order_id = p_order_id;
    end if;
  end if;

  return query select t.id, t.reg_no, t.race, v_outcome from public.registrations t where t.id = v_registration;
end;
$$;

-- Records a full refund made in Razorpay. Refunding the payment that paid for a registration
-- also cancels that registration (its ticket stops working). Returns 'refunded',
-- 'already_refunded' or 'unknown'.
create function public.mark_payment_refunded(p_payment_id text, p_by text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  o public.payments;
begin
  select * into o from public.payments x where x.payment_id = p_payment_id for update;
  if not found then return 'unknown'; end if;
  if o.status = 'refunded' then return 'already_refunded'; end if;

  update public.payments x set status = 'refunded', refunded_at = now() where x.order_id = o.order_id;
  if o.status = 'paid' then
    update public.registrations t
    set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Payment refunded'
    where t.id = o.registration_id and t.status <> 'cancelled';
    if found then
      insert into public.audit_log (registration_id, action, actor, details)
      values (o.registration_id, 'cancelled', p_by, jsonb_build_object('reason', 'Payment refunded'));
    end if;
  end if;
  return 'refunded';
end;
$$;

-- Counts one request against a limit, e.g. 30 per IP address per 10 minutes.
-- True if the request is within the limit.
create function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language sql volatile security definer set search_path = public
as $$
  insert into public.rate_limits as t (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end,
    hits = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end
  returning hits <= p_max;
$$;

-- ─── Housekeeping ───────────────────────────────────────────────────────────────────────────

-- Deletes registrations that were started but never paid, once they and their last checkout
-- attempt are older than p_days, along with runners left with no registration. Returns how
-- many registrations were deleted.
create function public.delete_stale_registrations(p_days int default 7)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => p_days);
  v_ids uuid[];
  v_runners uuid[];
begin
  select array_agg(r.id), array_agg(distinct r.runner_id) into v_ids, v_runners
  from public.registrations r
  where r.status = 'pending' and r.created_at < v_cutoff
    and not exists (
      select 1 from public.payments p
      where p.registration_id = r.id and (p.status in ('paid', 'refund_due', 'refunded') or p.created_at >= v_cutoff));
  if v_ids is null then return 0; end if;

  delete from public.audit_log where registration_id = any (v_ids);
  delete from public.payments where registration_id = any (v_ids);
  delete from public.registrations where id = any (v_ids);
  delete from public.runners u
  where u.id = any (v_runners) and not exists (select 1 from public.registrations r where r.runner_id = u.id);
  return cardinality(v_ids);
end;
$$;

-- Runs every night (see the schedule at the end of this file).
create function public.nightly_cleanup()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.delete_stale_registrations(7);   -- days to keep unpaid registrations
  delete from public.rate_limits where window_start < now() - interval '1 day';
end;
$$;

-- ─── Organisers and volunteers ──────────────────────────────────────────────────────────────

-- Hands over a paid runner's kit. If two volunteers tap at once, exactly one succeeds.
-- Returns 'collected', 'already_collected', 'not_paid' or 'not_found'.
create function public.collect_kit(p_registration uuid, p_by text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  select t.status into v_status from public.registrations t where t.id = p_registration for update;
  if v_status is null then return 'not_found'; end if;
  if v_status <> 'paid' then return 'not_paid'; end if;

  insert into public.kit_collections (registration_id, collected_by) values (p_registration, p_by) on conflict do nothing;
  if not found then return 'already_collected'; end if;

  insert into public.audit_log (registration_id, action, actor) values (p_registration, 'kit_collected', p_by);
  return 'collected';
end;
$$;

create function public.undo_kit(p_registration uuid, p_by text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.kit_collections where registration_id = p_registration;
  if found then
    insert into public.audit_log (registration_id, action, actor) values (p_registration, 'kit_undone', p_by);
  end if;
end;
$$;

-- Saves an organiser's edit to a registration and its runner (keys as in the tables; the race
-- is 'race'). Returns 'saved', 'not_found', or 'duplicate' if it would clash with another
-- runner or registration.
create function public.edit_registration(p_registration uuid, p jsonb, p_by text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  u public.runners := jsonb_populate_record(null::public.runners, p);
  r public.registrations := jsonb_populate_record(null::public.registrations, p);
  v_runner uuid;
  v_before jsonb;
  v_changes jsonb;
begin
  select t.runner_id, to_jsonb(x) || to_jsonb(t) into v_runner, v_before
  from public.registrations t join public.runners x on x.id = t.runner_id
  where t.id = p_registration for update of t;
  if v_runner is null then return 'not_found'; end if;

  -- Only the fields that really changed, old and new value, so the history shows what was done.
  select jsonb_object_agg(k.key, jsonb_build_object('from', v_before -> k.key, 'to', k.value)) into v_changes
  from jsonb_each(p) k
  where coalesce(nullif(v_before ->> k.key, ''), '') is distinct from coalesce(nullif(p ->> k.key, ''), '');
  if v_changes is null then return 'saved'; end if;

  update public.runners t set
    first_name = u.first_name, middle_name = u.middle_name, last_name = u.last_name, date_of_birth = u.date_of_birth,
    gender = u.gender, blood_group = u.blood_group, occupation = u.occupation, mobile = u.mobile, email = u.email,
    address = u.address, city = u.city, pincode = u.pincode, emergency_name = u.emergency_name,
    emergency_mobile = u.emergency_mobile, guardian_name = u.guardian_name, guardian_mobile = u.guardian_mobile,
    updated_at = now()
  where t.id = v_runner;

  update public.registrations t set race = r.race, tshirt_size = r.tshirt_size, admin_notes = r.admin_notes
  where t.id = p_registration;

  insert into public.audit_log (registration_id, action, actor, details)
  values (p_registration, 'edited', p_by, jsonb_build_object('changes', v_changes));
  return 'saved';
exception when unique_violation then
  return 'duplicate';
end;
$$;

create function public.cancel_registration(p_registration uuid, p_reason text, p_by text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.registrations
  set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(p_reason, '')
  where id = p_registration and status <> 'cancelled';
  if found then
    insert into public.audit_log (registration_id, action, actor, details)
    values (p_registration, 'cancelled', p_by, jsonb_build_object('reason', nullif(p_reason, '')));
  end if;
end;
$$;

-- Brings a cancelled registration back: to paid if it was paid, otherwise to pending.
create function public.restore_registration(p_registration uuid, p_by text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.registrations t
  set status = case when exists (select 1 from public.payments o where o.registration_id = t.id and o.status = 'paid')
                    then 'paid' else 'pending' end,
      cancelled_at = null, cancel_reason = null
  where t.id = p_registration and t.status = 'cancelled';
  if found then
    insert into public.audit_log (registration_id, action, actor) values (p_registration, 'restored', p_by);
  end if;
end;
$$;

-- Every headline number on the dashboard in one query.
-- p_minor_after: runners born after this date are under 18 on race day.
create function public.admin_summary(p_minor_after date)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'paid', count(*) filter (where r.status = 'paid'),
    'collected_paise', coalesce(sum(p.amount) filter (where r.status = 'paid'), 0),
    'unpaid', count(*) filter (where r.status = 'pending'),
    'cancelled', count(*) filter (where r.status = 'cancelled'),
    'kits', count(k.registration_id) filter (where r.status = 'paid'),
    'minors', count(*) filter (where r.status = 'paid' and u.date_of_birth > p_minor_after),
    'sizes', (
      select coalesce(jsonb_agg(jsonb_build_object('category', race, 'size', tshirt_size, 'count', n)), '[]'::jsonb)
      from (select race, tshirt_size, count(*) as n from public.registrations where status = 'paid' group by 1, 2) s
    )
  )
  from public.registrations r
  join public.runners u on u.id = r.runner_id
  left join public.payments p on p.registration_id = r.id and p.status = 'paid'
  left join public.kit_collections k on k.registration_id = r.id;
$$;

-- Only the website's server may call these.
do $$
declare
  f text;
begin
  foreach f in array array[
    'save_pending_registration(jsonb)', 'mark_order_paid(text, text)', 'collect_kit(uuid, text)', 'undo_kit(uuid, text)',
    'edit_registration(uuid, jsonb, text)', 'cancel_registration(uuid, text, text)', 'restore_registration(uuid, text)',
    'admin_summary(date)', 'race_has_room(text)', 'mark_payment_refunded(text, text)', 'hit_rate_limit(text, int, int)',
    'delete_stale_registrations(int)', 'nightly_cleanup()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
revoke all on sequence public.registration_number_seq from public, anon, authenticated;
grant usage, select on sequence public.registration_number_seq to service_role;

-- ─── Descriptions shown in Supabase's Table Editor ──────────────────────────────────────────

comment on table public.races is 'The runs on offer.';
comment on column public.races.capacity is 'Most paid runners allowed. Empty = no limit. Change it here at any time.';
comment on table public.runners is 'One row per person. Identified by mobile + date of birth + first name.';
comment on table public.registrations is 'One row per runner per race. Retrying checkout reuses the row; the number is given on payment.';
comment on column public.registrations.id is 'Also the ticket id in the runner''s QR code.';
comment on column public.registrations.reg_no is 'Shown as OIR-00001. Given in payment order; empty until paid.';
comment on column public.registrations.status is 'pending: not paid yet · paid: confirmed · cancelled: by an organiser';
comment on table public.payments is 'Every Razorpay checkout attempt. Lets a payment from an old checkout window find its registration.';
comment on column public.payments.status is 'created: window opened · paid: this paid the registration · failed · refund_due: money taken that must go back (see refund_reason) · refunded';
comment on column public.payments.refund_reason is 'duplicate: already paid · cancelled: registration was cancelled · sold_out: race filled up while paying';
comment on column public.payments.amount is 'In paise (₹200 = 20000).';
comment on table public.kit_collections is 'Kits handed over at the expo, and by whom.';
comment on table public.audit_log is 'Every change by organisers and volunteers (edits with old and new values, cancellations, kit check-ins) and every staff sign-in.';
comment on view public.registration_details is 'Read-only: each registration with its runner, payment and kit status.';
comment on table public.rate_limits is 'Short-lived request counters that slow down bots. Cleared nightly.';

commit;

-- ─── Nightly cleanup at 03:00 India time ────────────────────────────────────────────────────
-- Needs the pg_cron extension (allowed on every Supabase plan). Re-running replaces the job.
create extension if not exists pg_cron;
select cron.schedule('oir-nightly-cleanup', '30 21 * * *', 'select public.nightly_cleanup()');
