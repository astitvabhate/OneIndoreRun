import { z } from 'zod';
import { ageOn, ageReferenceDate, event, findRace, isValidDate } from '../eventData';
import { ageOnRaceDay, formatRegNo } from '../registrationSchema';
import { db } from './db';

export interface AdminRegistration {
  id: string;
  reg_no: number | null;
  created_at: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  mobile: string;
  email: string;
  city: string;
  address: string;
  pincode: string;
  date_of_birth: string;
  gender: string;
  blood_group: string | null;
  occupation: string | null;
  category: string;
  tshirt_size: string;
  guardian_name: string | null;
  guardian_mobile: string | null;
  emergency_name: string;
  emergency_mobile: string;
  consent_media: boolean;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  razorpay_payment_id: string | null;
  paid_at: string | null;
  kit_collected_at: string | null;
  kit_collected_by: string | null;
  admin_notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface RefundDue {
  payment_id: string;
  order_id: string;
  amount_inr: number;
  created_at: string;
  registration_number: string;
  first_name: string;
  last_name: string;
  mobile: string;
}

const pageSize = 1000; // Supabase returns at most 1000 rows per request

/** Every registration, newest first, read in pages. */
export async function allRegistrations() {
  const rows: AdminRegistration[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db().from('registrations').select('*').order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as AdminRegistration[]));
    if (data.length < pageSize) return rows;
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRegistration(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await db().from('registrations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminRegistration | null;
}

export interface PaymentAttempt {
  order_id: string;
  status: 'created' | 'paid' | 'failed' | 'duplicate';
  payment_id: string | null;
  amount: number;
  created_at: string;
}

/** Every checkout this runner opened, oldest first. */
export async function paymentAttempts(id: string) {
  const { data, error } = await db().from('payment_orders').select('order_id, status, payment_id, amount, created_at').eq('registration_id', id).order('created_at');
  if (error) throw error;
  return data as PaymentAttempt[];
}

export async function refundsDue() {
  const { data, error } = await db().from('payments_to_refund').select('*');
  if (error) throw error;
  return data as RefundDue[];
}

// ---------------------------------------------------------------------------------------------
// Kit check-in
// ---------------------------------------------------------------------------------------------

export type KitOutcome = 'collected' | 'already_collected' | 'not_paid' | 'not_found';

/**
 * Marks a paid runner's kit as collected. The update only matches a paid row whose kit hasn't
 * been collected, so if two volunteers tap at once, exactly one succeeds.
 */
export async function collectKit(id: string, by: string): Promise<{ outcome: KitOutcome; row: AdminRegistration | null }> {
  if (!uuidPattern.test(id)) return { outcome: 'not_found', row: null };
  const { data, error } = await db()
    .from('registrations')
    .update({ kit_collected_at: new Date().toISOString(), kit_collected_by: by })
    .eq('id', id)
    .eq('status', 'paid')
    .is('kit_collected_at', null)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data) return { outcome: 'collected', row: data as AdminRegistration };

  const row = await getRegistration(id);
  if (!row) return { outcome: 'not_found', row: null };
  return { outcome: row.kit_collected_at ? 'already_collected' : 'not_paid', row };
}

export async function undoKit(id: string, by: string) {
  const { error } = await db()
    .from('registrations')
    .update({ kit_collected_at: null, kit_collected_by: null, updated_at: new Date().toISOString(), updated_by: `${by} (undid kit check-in)` })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Editing, notes, cancelling
// ---------------------------------------------------------------------------------------------

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
    if (age < 18 && (!data.guardianName || !mobilePattern.test(data.guardianMobile ?? ''))) {
      ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Under-18 runners need a guardian name and 10-digit mobile.' });
    }
  });

export type AdminEdit = z.infer<typeof adminEditSchema>;

/** Saves an organiser's edits. Fails politely if they would make this runner a duplicate of another. */
export async function updateRunner(id: string, edit: AdminEdit, by: string) {
  const { error } = await db()
    .from('registrations')
    .update({
      first_name: edit.firstName, middle_name: edit.middleName, last_name: edit.lastName, mobile: edit.mobile, email: edit.email,
      city: edit.city, address: edit.address, pincode: edit.pincode, date_of_birth: edit.dateOfBirth, gender: edit.gender,
      blood_group: edit.bloodGroup, occupation: edit.occupation, category: edit.category, tshirt_size: edit.tshirtSize,
      emergency_name: edit.emergencyName, emergency_mobile: edit.emergencyMobile, guardian_name: edit.guardianName,
      guardian_mobile: edit.guardianMobile, admin_notes: edit.adminNotes, updated_at: new Date().toISOString(), updated_by: by,
    })
    .eq('id', id);
  if (error?.code === '23505') return 'Another registration already has this mobile, race, date of birth and first name.';
  if (error) throw error;
  return null;
}

export async function cancelRunner(id: string, reason: string, by: string) {
  const { error } = await db()
    .from('registrations')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason || null, updated_at: new Date().toISOString(), updated_by: by })
    .eq('id', id)
    .neq('status', 'cancelled');
  if (error) throw error;
}

/** Brings a cancelled runner back: to paid if they had paid, otherwise to pending. */
export async function restoreRunner(id: string, by: string) {
  const row = await getRegistration(id);
  if (!row || row.status !== 'cancelled') return;
  const { error } = await db()
    .from('registrations')
    .update({ status: row.razorpay_payment_id ? 'paid' : 'pending', cancelled_at: null, cancel_reason: null, updated_at: new Date().toISOString(), updated_by: `${by} (restored)` })
    .eq('id', id);
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

export function matchesSearch(row: AdminRegistration, q: string) {
  const needle = q.toLowerCase().replace(/^oir-0*/, '');
  if (!needle) return true;
  return [fullName(row), row.mobile, row.email, row.reg_no ? String(row.reg_no) : '', row.city].some((value) => value.toLowerCase().includes(needle));
}

export function applyFilters(rows: AdminRegistration[], { q, race, status, kit }: Filters) {
  return rows.filter((row) => {
    if (status === 'paid' && row.status !== 'paid') return false;
    if (status === 'unpaid' && (row.status === 'paid' || row.status === 'cancelled')) return false;
    if (status === 'cancelled' && row.status !== 'cancelled') return false;
    if (race && row.category !== race) return false;
    if (kit === 'collected' && !row.kit_collected_at) return false;
    if (kit === 'waiting' && (row.kit_collected_at || row.status !== 'paid')) return false;
    return matchesSearch(row, q);
  });
}

/** Headline numbers plus a T-shirt size count per race, for ordering kits. */
export function summarise(rows: AdminRegistration[]) {
  const paid = rows.filter((row) => row.status === 'paid');
  const sizes = event.tshirtSizes;
  const byRace = event.races.map((race) => {
    const runners = paid.filter((row) => row.category === race.slug);
    return { race: race.distance, slug: race.slug, total: runners.length, sizes: sizes.map((size) => runners.filter((row) => row.tshirt_size === size).length) };
  });
  return {
    paid: paid.length,
    collected: paid.reduce((sum, row) => sum + row.amount, 0) / 100,
    unpaid: rows.filter((row) => row.status === 'pending' || row.status === 'failed').length,
    cancelled: rows.filter((row) => row.status === 'cancelled').length,
    kits: paid.filter((row) => row.kit_collected_at).length,
    minors: paid.filter((row) => ageOnRaceDay(row.date_of_birth) < 18).length,
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

export function toCsv(rows: AdminRegistration[]) {
  const columns: [string, (row: AdminRegistration) => unknown][] = [
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
    ['Amount (INR)', (row) => row.amount / 100],
    ['Payment ID', (row) => row.razorpay_payment_id],
    ['Paid at', (row) => formatDateTime(row.paid_at)],
    ['Started at', (row) => formatDateTime(row.created_at)],
    ['Cancelled at', (row) => formatDateTime(row.cancelled_at)],
    ['Cancel reason', (row) => row.cancel_reason],
    ['Admin notes', (row) => row.admin_notes],
    ['Last edited', (row) => (row.updated_at ? `${formatDateTime(row.updated_at)} by ${row.updated_by}` : '')],
  ];
  const lines = [columns.map(([title]) => csvCell(title)).join(','), ...rows.map((row) => columns.map(([, get]) => csvCell(get(row))).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`; // BOM so Excel reads Hindi names correctly
}
