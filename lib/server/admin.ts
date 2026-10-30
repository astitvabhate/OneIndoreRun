import { z } from 'zod';
import { ageOn, ageReferenceDate, event, findRace, isValidDate } from '../eventData';
import { ageOnRaceDay, formatRegNo } from '../registrationSchema';
import { db, uuidPattern, type RegistrationStatus } from './db';

/** One row of the registration_details view: a registration with its runner, payment and kit. */
export interface AdminRegistration {
  id: string;
  reg_no: number | null;
  status: RegistrationStatus;
  category: string;
  tshirt_size: string;
  consent_media: boolean;
  admin_notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  runner_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group: string | null;
  occupation: string | null;
  mobile: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  emergency_name: string;
  emergency_mobile: string;
  guardian_name: string | null;
  guardian_mobile: string | null;
  amount: number | null; // paid amount in paise; null until paid
  razorpay_payment_id: string | null;
  paid_at: string | null;
  kit_collected_at: string | null;
  kit_collected_by: string | null;
}

export type RefundReason = 'duplicate' | 'cancelled' | 'sold_out';

export interface RefundDue {
  reason: RefundReason;
  payment_id: string;
  order_id: string;
  amount_inr: number;
  created_at: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  mobile: string;
}

// Every AdminRegistration field; the view's search_text column is only used for filtering.
const columns =
  'id, reg_no, status, category, tshirt_size, consent_media, admin_notes, cancelled_at, cancel_reason, created_at, ' +
  'runner_id, first_name, middle_name, last_name, date_of_birth, gender, blood_group, occupation, mobile, email, address, city, ' +
  'pincode, emergency_name, emergency_mobile, guardian_name, guardian_mobile, amount, razorpay_payment_id, paid_at, ' +
  'kit_collected_at, kit_collected_by';

const details = () => db().from('registration_details');

export async function getRegistration(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await details().select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as AdminRegistration | null;
}

export interface PaymentAttempt {
  order_id: string;
  status: 'created' | 'paid' | 'failed' | 'refund_due' | 'refunded';
  refund_reason: RefundReason | null;
  payment_id: string | null;
  amount: number;
  created_at: string;
}

/** Every checkout this registration opened, oldest first. */
export async function paymentAttempts(id: string) {
  const { data, error } = await db().from('payments').select('order_id, status, refund_reason, payment_id, amount, created_at').eq('registration_id', id).order('created_at');
  if (error) throw error;
  return data as PaymentAttempt[];
}

export type HistoryAction = 'edited' | 'cancelled' | 'restored' | 'kit_collected' | 'kit_undone' | 'signed_in';
export const historyActions: HistoryAction[] = ['kit_collected', 'kit_undone', 'edited', 'cancelled', 'restored', 'signed_in'];

export interface HistoryEntry {
  id: number;
  action: HistoryAction;
  actor: string;
  details: { reason?: string | null; changes?: Record<string, { from: unknown; to: unknown }> } | null;
  created_at: string;
}

/** What organisers and volunteers have done to this registration, newest first. */
export async function history(id: string) {
  const { data, error } = await db().from('audit_log').select('id, action, actor, details, created_at').eq('registration_id', id).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data as HistoryEntry[];
}

/**
 * Notes a staff sign-in in the activity log. A failure here must not lock staff out at the expo,
 * so it is logged to the server console instead of thrown.
 */
export async function recordSignIn(actor: string) {
  const { error } = await db().from('audit_log').insert({ action: 'signed_in', actor });
  if (error) console.error('Could not record sign-in', error);
}

export interface ActivityEntry extends HistoryEntry {
  registration_id: string | null;
  registrations: { reg_no: number | null; runners: { first_name: string; last_name: string } | null } | null;
}

export interface ActivityFilters {
  who: string;
  action: HistoryAction | '';
  day: string; // YYYY-MM-DD, India time
}

export function readActivityFilters(params: Record<string, string | string[] | undefined>): ActivityFilters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '';
  const action = one('action') as HistoryAction;
  return {
    who: one('who').trim().slice(0, 60),
    action: historyActions.includes(action) ? action : '',
    day: isValidDate(one('day')) ? one('day') : '',
  };
}

/** One page of the whole activity log, newest first, with the runner each entry is about. */
export async function activityPage({ who, action, day }: ActivityFilters, page: number, perPage: number) {
  const build = () => {
    let query = db()
      .from('audit_log')
      .select('id, action, actor, details, created_at, registration_id, registrations(reg_no, runners(first_name, last_name))', { count: 'exact' });
    if (who) query = query.ilike('actor', `%${who.replace(/[%_\\]/g, '')}%`);
    if (action) query = query.eq('action', action);
    if (day) {
      const start = new Date(`${day}T00:00:00+05:30`);
      query = query.gte('created_at', start.toISOString()).lt('created_at', new Date(start.getTime() + 86_400_000).toISOString());
    }
    return query;
  };
  const from = (page - 1) * perPage;
  const { data, count, error } = await build().order('created_at', { ascending: false }).range(from, from + perPage - 1);
  if (error?.code === 'PGRST103') {
    const { count: total, error: countError } = await build().limit(0);
    if (countError) throw countError;
    return { rows: [] as ActivityEntry[], total: total ?? 0 };
  }
  if (error) throw error;
  return { rows: data as unknown as ActivityEntry[], total: count ?? 0 };
}

/** Money taken that can't count towards a place, oldest first. Refund these in Razorpay; the webhook then clears them. */
export async function refundsDue(): Promise<RefundDue[]> {
  const { data, error } = await db()
    .from('payments')
    .select('payment_id, order_id, amount, created_at, refund_reason, registration:registrations(reg_no, runner:runners(first_name, last_name, mobile))')
    .eq('status', 'refund_due')
    .order('created_at');
  if (error) throw error;
  type Row = {
    payment_id: string; order_id: string; amount: number; created_at: string; refund_reason: RefundReason;
    registration: { reg_no: number | null; runner: { first_name: string; last_name: string; mobile: string } };
  };
  return (data as unknown as Row[]).map(({ registration, amount, refund_reason, ...payment }) => ({
    ...payment,
    reason: refund_reason,
    amount_inr: amount / 100,
    registration_number: registration.reg_no ? formatRegNo(registration.reg_no) : '—',
    first_name: registration.runner.first_name,
    last_name: registration.runner.last_name,
    mobile: registration.runner.mobile,
  }));
}

// ---------------------------------------------------------------------------------------------
// Changes. Each is one database function that also writes the audit log (see schema.sql).
// ---------------------------------------------------------------------------------------------

export type KitOutcome = 'collected' | 'already_collected' | 'not_paid' | 'not_found';

/** Hands over a paid runner's kit. If two volunteers tap at once, exactly one succeeds. */
export async function collectKit(id: string, by: string): Promise<KitOutcome> {
  if (!uuidPattern.test(id)) return 'not_found';
  const { data, error } = await db().rpc('collect_kit', { p_registration: id, p_by: by });
  if (error) throw error;
  return data as KitOutcome;
}

export async function undoKit(id: string, by: string) {
  const { error } = await db().rpc('undo_kit', { p_registration: id, p_by: by });
  if (error) throw error;
}

const mobilePattern = /^[6-9]\d{9}$/;
const optional = z.string().trim().max(200).transform((value) => value || null);

/** What an organiser may change on a runner. Same rules as the public form. */
export const adminEditSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Enter a first name.').max(60),
    middleName: optional,
    lastName: z.string().trim().min(2, 'Enter a last name.').max(60),
    mobile: z.string().trim().regex(mobilePattern, 'Enter a valid 10-digit mobile.'),
    email: z.string().trim().toLowerCase().email('Enter a valid email.').max(120),
    city: z.string().trim().min(2, 'Enter a city.').max(80),
    address: z.string().trim().min(5, 'Enter an address.').max(300),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode.'),
    dateOfBirth: z.string().refine(isValidDate, 'Enter a valid date of birth.'),
    gender: z.string().min(1).max(20),
    bloodGroup: optional,
    occupation: optional,
    category: z.enum(['3km', '5km', '10km']),
    tshirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
    emergencyName: z.string().trim().min(2, 'Enter an emergency contact.').max(80),
    emergencyMobile: z.string().trim().regex(mobilePattern, 'Enter a valid 10-digit mobile.'),
    guardianName: optional,
    guardianMobile: optional,
    adminNotes: z.string().trim().max(1000).transform((value) => value || null),
  })
  .superRefine((data, ctx) => {
    if (!isValidDate(data.dateOfBirth)) return;
    const age = ageOn(data.dateOfBirth, ageReferenceDate());
    if (age < event.minAge) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: `Runner must be at least ${event.minAge} on race day.` });
  });

export type AdminEdit = z.infer<typeof adminEditSchema>;

/** Saves an organiser's edits to a registration and its runner. Returns a message if it can't. */
export async function updateRunner(id: string, edit: AdminEdit, by: string) {
  const { data, error } = await db().rpc('edit_registration', {
    p_registration: id,
    p_by: by,
    p: {
      first_name: edit.firstName, middle_name: edit.middleName, last_name: edit.lastName, date_of_birth: edit.dateOfBirth,
      gender: edit.gender, blood_group: edit.bloodGroup, occupation: edit.occupation, mobile: edit.mobile, email: edit.email,
      address: edit.address, city: edit.city, pincode: edit.pincode, emergency_name: edit.emergencyName,
      emergency_mobile: edit.emergencyMobile, guardian_name: edit.guardianName, guardian_mobile: edit.guardianMobile,
      race: edit.category, tshirt_size: edit.tshirtSize, admin_notes: edit.adminNotes,
    },
  });
  if (error) throw error;
  if (data === 'duplicate') return 'Another runner already has this mobile, date of birth and first name, or this runner is already in that race.';
  if (data === 'not_found') return 'This registration no longer exists.';
  return null;
}

export async function cancelRunner(id: string, reason: string, by: string) {
  const { error } = await db().rpc('cancel_registration', { p_registration: id, p_reason: reason, p_by: by });
  if (error) throw error;
}

/** Brings a cancelled registration back: to paid if it was paid, otherwise to pending. */
export async function restoreRunner(id: string, by: string) {
  const { error } = await db().rpc('restore_registration', { p_registration: id, p_by: by });
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Display helpers, filters, summary, CSV
// ---------------------------------------------------------------------------------------------

export const fullName = (row: AdminRegistration) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ');
export const regNoLabel = (row: AdminRegistration) => (row.reg_no ? formatRegNo(row.reg_no) : '—');
export const raceLabel = (row: AdminRegistration) => findRace(row.category)?.distance ?? row.category;
export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
export const formatTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export interface Filters {
  q: string;
  race: string;
  status: 'paid' | 'unpaid' | 'cancelled' | 'all';
  kit: '' | 'collected' | 'waiting';
}

export function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '';
  const status = one('status');
  const kit = one('kit');
  return {
    q: one('q').trim().slice(0, 100),
    race: findRace(one('race')) ? one('race') : '',
    status: status === 'unpaid' || status === 'cancelled' || status === 'all' ? status : 'paid',
    kit: kit === 'collected' || kit === 'waiting' ? kit : '',
  };
}

/**
 * PostgREST `or` filter for a search box: any part of the name, mobile, email or city, or an exact
 * registration number ("OIRI-00012", older "OIR-00012", or "12"). Served by the trigram index on search_text.
 */
function searchFilter(q: string) {
  const needle = q.trim().toLowerCase().replace(/^oiri?-0*/, '').replace(/[*%\\"]/g, '');
  if (!needle) return null;
  const text = `search_text.ilike."%${needle}%"`;
  return /^\d{1,9}$/.test(needle) ? `${text},reg_no.eq.${Number(needle)}` : text;
}

/** The registrations matching the dashboard filters, with the total count. */
function filteredRegistrations({ q, race, status, kit }: Filters) {
  let query = details().select(columns, { count: 'exact' });
  if (status === 'paid') query = query.eq('status', 'paid');
  if (status === 'unpaid') query = query.eq('status', 'pending');
  if (status === 'cancelled') query = query.eq('status', 'cancelled');
  if (race) query = query.eq('category', race);
  if (kit === 'collected') query = query.not('kit_collected_at', 'is', null);
  if (kit === 'waiting') query = query.eq('status', 'paid').is('kit_collected_at', null);
  const search = searchFilter(q);
  if (search) query = query.or(search);
  return query;
}

/** One page of matching registrations, newest first, and how many match in total. */
export async function registrationsPage(filters: Filters, page: number, perPage: number) {
  const from = (page - 1) * perPage;
  const { data, count, error } = await filteredRegistrations(filters).order('created_at', { ascending: false }).range(from, from + perPage - 1);
  // A page past the end (e.g. an old link) is not an error: show it empty with the real total.
  if (error?.code === 'PGRST103') {
    const { count: total, error: countError } = await filteredRegistrations(filters).limit(0);
    if (countError) throw countError;
    return { rows: [], total: total ?? 0 };
  }
  if (error) throw error;
  return { rows: data as unknown as AdminRegistration[], total: count ?? 0 };
}

const exportBatch = 1000; // Supabase returns at most 1000 rows per request

/** Every matching registration in registration-number order, a batch at a time, for the CSV export. */
export async function* registrationsForExport(filters: Filters) {
  for (let from = 0; ; from += exportBatch) {
    const { data, error } = await filteredRegistrations(filters)
      .order('reg_no', { ascending: true, nullsFirst: false })
      .order('created_at')
      .order('id')
      .range(from, from + exportBatch - 1);
    if (error) throw error;
    yield data as unknown as AdminRegistration[];
    if (data.length < exportBatch) return;
  }
}

/** Up to 30 paid or cancelled runners matching a check-in search. */
export async function searchCheckIn(q: string) {
  const search = searchFilter(q);
  if (!search) return [];
  const { data, error } = await details()
    .select(columns)
    .in('status', ['paid', 'cancelled'])
    .or(search)
    .order('reg_no', { ascending: true, nullsFirst: false })
    .limit(30);
  if (error) throw error;
  return data as unknown as AdminRegistration[];
}

/** Runners born after this date are under 18 on race day. */
function minorCutoff() {
  const reference = ageReferenceDate();
  return `${Number(reference.slice(0, 4)) - 18}${reference.slice(4)}`;
}

interface SummaryRow {
  paid: number;
  collected_paise: number;
  unpaid: number;
  cancelled: number;
  kits: number;
  minors: number;
  sizes: { category: string; size: string; count: number }[];
}

/** Headline numbers plus a T-shirt size count per race, for ordering kits. Counted in the database. */
export async function summary() {
  const { data, error } = await db().rpc('admin_summary', { p_minor_after: minorCutoff() });
  if (error) throw error;
  const row = data as SummaryRow;
  const sizes = event.tshirtSizes;
  const count = (category: string, size: string) => row.sizes.find((entry) => entry.category === category && entry.size === size)?.count ?? 0;
  const byRace = event.races.map((race) => {
    const counts = sizes.map((size) => count(race.slug, size));
    return { race: race.distance, slug: race.slug, total: counts.reduce((sum, n) => sum + n, 0), sizes: counts };
  });
  return {
    paid: row.paid,
    collected: row.collected_paise / 100,
    unpaid: row.unpaid,
    cancelled: row.cancelled,
    kits: row.kits,
    minors: row.minors,
    sizes,
    byRace,
    sizeTotals: sizes.map((_, index) => byRace.reduce((sum, race) => sum + race.sizes[index], 0)),
  };
}

// Spreadsheet apps run cells starting with = + - @ as formulas; prefix them so they stay text.
const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvColumns: [string, (row: AdminRegistration) => unknown][] = [
  ['Registration no.', regNoLabel],
  ['Status', (row) => row.status],
  ['Race', raceLabel],
  ['T-shirt', (row) => row.tshirt_size],
  ['Kit collected at', (row) => formatDateTime(row.kit_collected_at)],
  ['Kit given by', (row) => row.kit_collected_by],
  ['First name', (row) => row.first_name],
  ['Middle name', (row) => row.middle_name],
  ['Last name', (row) => row.last_name],
  ['Date of birth', (row) => row.date_of_birth],
  ['Age on race day', (row) => ageOnRaceDay(row.date_of_birth)],
  ['Gender', (row) => row.gender],
  ['Blood group', (row) => row.blood_group],
  ['Mobile', (row) => row.mobile],
  ['Email', (row) => row.email],
  ['City', (row) => row.city],
  ['Address', (row) => row.address],
  ['Pincode', (row) => row.pincode],
  ['Occupation', (row) => row.occupation],
  ['Emergency contact', (row) => row.emergency_name],
  ['Emergency mobile', (row) => row.emergency_mobile],
  ['Guardian', (row) => row.guardian_name],
  ['Guardian mobile', (row) => row.guardian_mobile],
  ['Photo consent', (row) => (row.consent_media ? 'Yes' : 'No')],
  ['Amount paid (INR)', (row) => (row.amount === null ? '' : row.amount / 100)],
  ['Payment ID', (row) => row.razorpay_payment_id],
  ['Paid at', (row) => formatDateTime(row.paid_at)],
  ['Started at', (row) => formatDateTime(row.created_at)],
  ['Cancelled at', (row) => formatDateTime(row.cancelled_at)],
  ['Cancel reason', (row) => row.cancel_reason],
  ['Admin notes', (row) => row.admin_notes],
];

// BOM so Excel reads Hindi names correctly.
export const csvHeader = () => `﻿${csvColumns.map(([title]) => csvCell(title)).join(',')}\r\n`;
export const csvRows = (rows: AdminRegistration[]) => rows.map((row) => `${csvColumns.map(([, get]) => csvCell(get(row))).join(',')}\r\n`).join('');
