import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RegistrationInput } from '../registrationSchema';
import { serverConfig } from './config';

export type RegistrationStatus = 'pending' | 'paid' | 'cancelled';
/** What a confirmed payment did. Anything but paid / already_paid means the money must be refunded. */
export type PaymentOutcome = 'paid' | 'already_paid' | 'duplicate' | 'cancelled' | 'sold_out';

let client: SupabaseClient | undefined;

// Uses the service-role key, which bypasses row-level security. Never import this from client code.
// One client per server instance, so requests share its HTTP connections.
export function db() {
  client ??= createClient(serverConfig.supabaseUrl!, serverConfig.supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }) },
  });
  return client;
}

/** Form fields as runners and registrations columns (see save_pending_registration in schema.sql). */
const toColumns = (input: RegistrationInput) => ({
  first_name: input.firstName,
  middle_name: input.middleName || null,
  last_name: input.lastName,
  date_of_birth: input.dateOfBirth,
  gender: input.gender,
  blood_group: input.bloodGroup || null,
  occupation: input.occupation === 'Other' ? input.occupationOther || 'Other' : input.occupation || null,
  mobile: input.mobile,
  email: input.email,
  address: input.address,
  city: input.city,
  pincode: input.pincode,
  emergency_name: input.emergencyName,
  emergency_mobile: input.emergencyMobile,
  guardian_name: input.guardianName || null,
  guardian_mobile: input.guardianMobile || null,
  race: input.category,
  tshirt_size: input.tshirtSize,
  consent_risk: input.consentRisk,
  consent_rules: input.consentRules,
  consent_media: input.consentMedia,
});

/**
 * Saves the runner and their registration in one database call. A repeat attempt by the same
 * runner for the same race reuses their rows. If they have already paid (or were cancelled), that
 * registration comes back unchanged with its status. Status 'full' (and no id) if the race is sold out.
 */
export async function savePending(input: RegistrationInput) {
  const { data, error } = await db().rpc('save_pending_registration', { p: toColumns(input) });
  if (error) throw error;
  const [row] = data as { ticket_id: string | null; reg_status: RegistrationStatus | 'full'; reg_number: number | null }[];
  return row.reg_status === 'full'
    ? { status: 'full' as const }
    : { id: row.ticket_id!, status: row.reg_status, regNo: row.reg_number };
}

/** Records a Razorpay checkout attempt for a registration. A registration can have several. */
export async function recordOrder(registrationId: string, orderId: string, amount: number) {
  const { error } = await db().from('payments').insert({ order_id: orderId, registration_id: registrationId, amount });
  if (error) throw error;
}

/**
 * Records a captured payment (see mark_order_paid in schema.sql for the outcomes). Repeats are
 * harmless. Null for an unknown order.
 */
export async function markPaid(orderId: string, paymentId: string) {
  const { data, error } = await db().rpc('mark_order_paid', { p_order_id: orderId, p_payment_id: paymentId });
  if (error) throw error;
  const [row] = (data ?? []) as { ticket_id: string; reg_number: number; race: string; outcome: PaymentOutcome }[];
  return row ? { id: row.ticket_id, regNo: row.reg_number, category: row.race, outcome: row.outcome } : null;
}

/** True if this Razorpay order was opened by this website (the account may be used for other things). */
export async function isOurOrder(orderId: string) {
  const { count, error } = await db().from('payments').select('order_id', { count: 'exact', head: true }).eq('order_id', orderId);
  if (error) throw error;
  return count === 1;
}

/** Records a full refund made in Razorpay; refunding a registration's payment cancels it. */
export async function markRefunded(paymentId: string) {
  const { data, error } = await db().rpc('mark_payment_refunded', { p_payment_id: paymentId, p_by: 'Razorpay refund' });
  if (error) throw error;
  return data as 'refunded' | 'already_refunded' | 'unknown';
}

/** A failed attempt only affects its own payment row; the runner can retry. Never touches paid ones. */
export async function markFailed(orderId: string) {
  const { error } = await db().from('payments').update({ status: 'failed' }).eq('order_id', orderId).eq('status', 'created');
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
  amount: number | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  kit_collected_at: string | null;
  kit_collected_by: string | null;
  organisation: string | null; // imported with this group
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Looks a ticket up by its unguessable registration id; null for unknown or malformed ids. */
export const ticketColumns = 'id, reg_no, status, first_name, middle_name, last_name, category, tshirt_size, amount, razorpay_payment_id, paid_at, kit_collected_at, kit_collected_by, organisation';

export async function getTicket(id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await db()
    .from('registration_details')
    .select(ticketColumns)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TicketRow | null;
}

/** Paid or cancelled registrations for a runner, found by mobile and date of birth. */
export async function findTickets(mobile: string, dateOfBirth: string) {
  const { data, error } = await db()
    .from('registration_details')
    .select('id, reg_no, status, first_name, last_name, category')
    .eq('mobile', mobile)
    .eq('date_of_birth', dateOfBirth)
    .neq('status', 'pending')
    .order('reg_no')
    .limit(10);
  if (error) throw error;
  return data as { id: string; reg_no: number | null; status: RegistrationStatus; first_name: string; last_name: string; category: string }[];
}

/** Counts one request against a limit. True if allowed. */
export async function hitRateLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await db().rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw error;
  return data as boolean;
}
