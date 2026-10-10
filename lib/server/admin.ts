import { event, findRace } from '../eventData';
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
  status: string;
  razorpay_payment_id: string | null;
  paid_at: string | null;
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

export async function refundsDue() {
  const { data, error } = await db().from('payments_to_refund').select('*');
  if (error) throw error;
  return data as RefundDue[];
}

export const fullName = (row: AdminRegistration) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ');
export const regNoLabel = (row: AdminRegistration) => (row.reg_no ? formatRegNo(row.reg_no) : '—');
export const raceLabel = (row: AdminRegistration) => findRace(row.category)?.distance ?? row.category;
export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';

export interface Filters {
  q: string;
  race: string;
  status: 'paid' | 'unpaid' | 'all';
}

export function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '';
  const status = one('status');
  return {
    q: one('q').trim().slice(0, 100),
    race: findRace(one('race')) ? one('race') : '',
    status: status === 'unpaid' || status === 'all' ? status : 'paid',
  };
}

export function applyFilters(rows: AdminRegistration[], { q, race, status }: Filters) {
  const needle = q.toLowerCase().replace(/^oir-0*/, '');
  return rows.filter((row) => {
    if (status === 'paid' && row.status !== 'paid') return false;
    if (status === 'unpaid' && row.status === 'paid') return false;
    if (race && row.category !== race) return false;
    if (!needle) return true;
    return [fullName(row), row.mobile, row.email, row.reg_no ? String(row.reg_no) : '', row.city].some((value) => value.toLowerCase().includes(needle));
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
    unpaid: rows.length - paid.length,
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
  ];
  const lines = [columns.map(([title]) => csvCell(title)).join(','), ...rows.map((row) => columns.map(([, get]) => csvCell(get(row))).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`; // BOM so Excel reads ₹ and Hindi names correctly
}
