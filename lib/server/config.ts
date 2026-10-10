// Server-only settings. None of these use the NEXT_PUBLIC_ prefix, so they never reach the browser.
export const serverConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
};

/** Registration stays in "opening soon" mode until the database and payment keys are set. */
export function isRegistrationOpen() {
  const { supabaseUrl, supabaseServiceKey, razorpayKeyId, razorpayKeySecret } = serverConfig;
  return Boolean(supabaseUrl && supabaseServiceKey && razorpayKeyId && razorpayKeySecret);
}
