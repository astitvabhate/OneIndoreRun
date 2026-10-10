import { createClient } from '@supabase/supabase-js';
import type { RegistrationInput } from '../registrationSchema';
import { serverConfig } from './config';

export type RegistrationStatus = 'pending' | 'paid' | 'failed';

export interface RegistrationRow {
  id: string;
  reg_no: number;
  status: RegistrationStatus;
  category: string;
  amount: number;
  razorpay_order_id: string | null;
}

// Uses the service-role key, which bypasses row-level security. Never import this from client code.
function db() {
  return createClient(serverConfig.supabaseUrl!, serverConfig.supabaseServiceKey!, { auth: { persistSession: false } });
}

const columns = 'id, reg_no, status, category, amount, razorpay_order_id';

/** A paid entry for this mobile number and race, if one exists. */
export async function findPaid(mobile: string, category: string) {
  const { data, error } = await db()
    .from('registrations')
    .select(columns)
    .eq('mobile', mobile)
    .eq('category', category)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RegistrationRow | null;
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
  age: input.age,
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

/** Each checkout attempt gets its own pending row, so a late payment on an old order still matches. */
export async function savePending(input: RegistrationInput, amount: number) {
  const { data, error } = await db()
    .from('registrations')
    .insert({ ...toColumns(input, amount), status: 'pending' })
    .select(columns)
    .single();
  if (error) throw error;
  return data as RegistrationRow;
}

export async function attachOrder(id: string, orderId: string) {
  const { error } = await db().from('registrations').update({ razorpay_order_id: orderId }).eq('id', id);
  if (error) throw error;
}

/** Marks the registration for this order as paid; null if no such order. Safe to call twice (verify + webhook). */
export async function markPaid(orderId: string, paymentId: string) {
  const { data, error } = await db()
    .from('registrations')
    .update({ status: 'paid', razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq('razorpay_order_id', orderId)
    .select(columns)
    .maybeSingle();
  if (error) throw error;
  return data as RegistrationRow | null;
}

export async function markFailed(orderId: string) {
  const { error } = await db().from('registrations').update({ status: 'failed' }).eq('razorpay_order_id', orderId).neq('status', 'paid');
  if (error) throw error;
}
