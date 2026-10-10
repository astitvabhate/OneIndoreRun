import { createClient } from '@supabase/supabase-js';
import type { RegistrationInput } from '../registrationSchema';
import { serverConfig } from './config';

export type RegistrationStatus = 'pending' | 'paid' | 'failed';
export type PaymentOutcome = 'paid' | 'already_paid' | 'duplicate';

// Uses the service-role key, which bypasses row-level security. Never import this from client code.
function db() {
  return createClient(serverConfig.supabaseUrl!, serverConfig.supabaseServiceKey!, { auth: { persistSession: false } });
}

const toColumns = (input: RegistrationInput, amount: number) => ({
  first_name: input.firstName,
  middle_name: input.middleName || null,
  last_name: input.lastName,
  mobile: input.mobile,
  email: input.email,
  city: input.city,
  address: input.address,
  pincode: input.pincode,
  date_of_birth: input.dateOfBirth,
  gender: input.gender,
  blood_group: input.bloodGroup || null,
  occupation: input.occupation === 'Other' ? input.occupationOther || 'Other' : input.occupation || null,
  category: input.category,
  tshirt_size: input.tshirtSize,
  guardian_name: input.guardianName || null,
  guardian_mobile: input.guardianMobile || null,
  emergency_name: input.emergencyName,
  emergency_mobile: input.emergencyMobile,
  consent_risk: input.consentRisk,
  consent_rules: input.consentRules,
  consent_media: input.consentMedia,
  amount,
});

/**
 * Saves the runner's latest details. A repeat attempt by the same runner (mobile, race, date of
 * birth, first name) reuses their unpaid row. If they have already paid, the paid row comes back
 * unchanged with status 'paid'. Runs as one database statement, so double-clicks can't make two rows.
 */
export async function savePending(input: RegistrationInput, amount: number) {
  const { data, error } = await db().rpc('save_pending_registration', { p: toColumns(input, amount) });
  if (error) throw error;
  const [row] = data as { ticket_id: string; reg_status: RegistrationStatus; reg_number: number | null }[];
  return { id: row.ticket_id, status: row.reg_status, regNo: row.reg_number };
}

/** Links a Razorpay order to its runner. A runner can have several orders (one per attempt). */
export async function recordOrder(registrationId: string, orderId: string, amount: number) {
  const { error } = await db().from('payment_orders').insert({ order_id: orderId, registration_id: registrationId, amount });
  if (error) throw error;
}

/**
 * Records a captured payment. The first one marks the runner paid and assigns the next
 * registration number; repeats are harmless; a second, different payment is flagged 'duplicate'
 * for refund. Null for an unknown order.
 */
export async function markPaid(orderId: string, paymentId: string) {
  const { data, error } = await db().rpc('mark_order_paid', { p_order_id: orderId, p_payment_id: paymentId });
  if (error) throw error;
  const [row] = (data ?? []) as { ticket_id: string; reg_number: number; race: string; outcome: PaymentOutcome }[];
  return row ? { id: row.ticket_id, regNo: row.reg_number, category: row.race, outcome: row.outcome } : null;
}

/** A failed attempt only affects its own order; the runner can retry. Never touches paid orders. */
export async function markFailed(orderId: string) {
  const { error } = await db().from('payment_orders').update({ status: 'failed' }).eq('order_id', orderId).eq('status', 'created');
  if (error) throw error;
}

export interface TicketRow {
  id: string;
  reg_no: number | null;
  status: RegistrationStatus;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  category: string;
  tshirt_size: string;
  amount: number;
  razorpay_payment_id: string | null;
  paid_at: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Looks a ticket up by its unguessable registration id; null for unknown or malformed ids. */
export async function getTicket(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await db()
    .from('registrations')
    .select('id, reg_no, status, first_name, middle_name, last_name, category, tshirt_size, amount, razorpay_payment_id, paid_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TicketRow | null;
}
