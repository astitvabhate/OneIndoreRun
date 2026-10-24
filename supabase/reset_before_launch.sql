-- ⚠ Deletes ALL runners, registrations, payments, kit check-ins and history, and restarts
-- numbering at OIR-00001. Tables, races and functions stay as they are.
-- Use once, just before opening registrations to the public, to clear out test entries.
-- Never run this after real runners have registered.

begin;
delete from public.audit_log;
delete from public.kit_collections;
delete from public.payments;
delete from public.registrations;
delete from public.runners;
delete from public.rate_limits;
select setval('public.registration_number_seq', 1, false);
commit;
