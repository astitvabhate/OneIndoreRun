import { event } from '../eventData';

// Server-only settings. None of these use the NEXT_PUBLIC_ prefix, so they never reach the browser.
export const serverConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
};

/** The database and payment keys are set, so payments can be taken and confirmed. */
export function isPaymentConfigured() {
  const { supabaseUrl, supabaseServiceKey, razorpayKeyId, razorpayKeySecret } = serverConfig;
  return Boolean(supabaseUrl && supabaseServiceKey && razorpayKeyId && razorpayKeySecret);
}

/** Past the closing time set in eventData. */
export const isRegistrationClosed = () => event.registrationClosesAt !== null && Date.now() >= Date.parse(event.registrationClosesAt);

/**
 * New registrations are accepted: keys set and not past the closing time. Confirming a payment
 * only needs isPaymentConfigured, so runners mid-checkout at closing time are still recorded.
 */
export const isRegistrationOpen = () => isPaymentConfigured() && !isRegistrationClosed();
