-- ⚠ Deletes the whole One Indore Run database: every table, row, view and function, including
-- those from older setups. Use it to start over during development, then run schema.sql.
-- Never run this after real runners have registered.
-- Run in Supabase: SQL Editor → New query → paste → Run.

-- The nightly cleanup job, if pg_cron is installed.
do $$
begin
  perform cron.unschedule('oir-nightly-cleanup');
exception when others then
  null; -- no pg_cron, or no such job
end;
$$;

begin;

-- Current setup
drop view if exists public.organisation_summary;
drop view if exists public.registration_details;
drop function if exists public.save_pending_registration(jsonb);
drop function if exists public.mark_order_paid(text, text);
drop function if exists public.collect_kit(uuid, text);
drop function if exists public.undo_kit(uuid, text);
drop function if exists public.collect_organisation_kits(uuid, text);
drop function if exists public.edit_registration(uuid, jsonb, text);
drop function if exists public.cancel_registration(uuid, text, text);
drop function if exists public.restore_registration(uuid, text);
drop function if exists public.admin_summary(date);
drop function if exists public.race_has_room(text);
drop function if exists public.mark_payment_refunded(text, text);
drop function if exists public.hit_rate_limit(text, int, int);
drop function if exists public.delete_stale_registrations(int);
drop function if exists public.nightly_cleanup();
drop table if exists public.staff_users;
drop table if exists public.issues;
drop table if exists public.rate_limits;
drop table if exists public.audit_log;
drop table if exists public.kit_collections;
drop table if exists public.payments;
drop table if exists public.registrations;
drop table if exists public.organisations;
drop table if exists public.runners;
drop table if exists public.races;
drop sequence if exists public.registration_number_seq;

-- Older setups
drop view if exists public.payments_to_refund;
drop view if exists public.paid_registrations;
drop table if exists public.payment_orders;

commit;

-- Result shown in the SQL Editor: tables_left should be 0.
select count(*) as tables_left
from information_schema.tables
where table_schema = 'public'
  and table_name in ('races', 'runners', 'registrations', 'payments', 'kit_collections', 'audit_log', 'rate_limits', 'payment_orders');
