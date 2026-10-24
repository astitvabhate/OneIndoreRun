-- Upgrade for a database set up with an earlier schema.sql: a full activity log.
--   • edits now record only the fields that changed, with their old and new values
--   • staff sign-ins are recorded too (they belong to no registration)
-- Safe to run more than once. Run in Supabase: SQL Editor → New query → paste → Run.
-- A fresh setup does not need this: schema.sql already includes it.

begin;

alter table public.audit_log alter column registration_id drop not null;
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('edited', 'cancelled', 'restored', 'kit_collected', 'kit_undone', 'signed_in'));
create index if not exists audit_log_recent on public.audit_log (created_at desc);

-- Saves an organiser's edit to a registration and its runner (keys as in the tables; the race
-- is 'race'). Returns 'saved', 'not_found', or 'duplicate' if it would clash with another
-- runner or registration.
create or replace function public.edit_registration(p_registration uuid, p jsonb, p_by text)
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

comment on table public.audit_log is 'Every change by organisers and volunteers (edits with old and new values, cancellations, kit check-ins) and every staff sign-in.';

commit;
