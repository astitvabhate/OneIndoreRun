-- ⚠ Deletes ALL registrations and payment records, and restarts numbering at OIR-00001.
-- Use once, just before opening registrations to the public, to clear out test entries.
-- Never run this after real runners have registered.

begin;
delete from public.payment_orders;
delete from public.registrations;
select setval('public.registration_number_seq', 1, false);
commit;
