// Checks that the Supabase and Razorpay keys in .env.local work. Read-only: it creates,
// changes and charges nothing, and never prints secret values.
// Run with: npm run check:setup

const env = process.env;
let failures = 0;

const ok = (message) => console.log(`  ✓ ${message}`);
const fail = (message, hint) => {
  failures++;
  console.log(`  ✗ ${message}${hint ? `\n      → ${hint}` : ''}`);
};

console.log('\nSupabase');
const supabaseUrl = env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local');
} else {
  const role = (() => {
    try {
      return JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString()).role;
    } catch {
      return undefined;
    }
  })();
  if (role === 'anon') fail('SUPABASE_SERVICE_ROLE_KEY is the "anon" key', 'Use the "service_role" secret from Project Settings → API.');

  const query = async (path) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'count=exact' } });
    return { response, body: await response.text() };
  };
  try {
    const table = await query('registrations?select=id&limit=1');
    if (table.response.ok) {
      ok(`connected; ${table.response.headers.get('content-range')?.split('/')[1] ?? 0} registrations`);
      const missing = [];
      for (const name of ['races', 'runners', 'payments', 'kit_collections', 'audit_log', 'rate_limits', 'staff_users', 'registration_details']) {
        if (!(await query(`${name}?limit=1`)).response.ok) missing.push(name);
      }
      missing.length
        ? fail(`missing: ${missing.join(', ')} (older database layout)`, 'Rebuild: run supabase/drop_everything.sql, then supabase/schema.sql.')
        : ok('all tables and the registration_details view found');
    } else if (table.response.status === 401) {
      fail('Supabase rejected the key', 'Copy the service_role secret again from Project Settings → API.');
    } else if (table.body.includes('PGRST205') || table.body.includes('does not exist') || table.response.status === 404) {
      fail('connected, but the database is empty', 'Open SQL Editor, paste supabase/schema.sql and click Run.');
    } else {
      fail(`unexpected response ${table.response.status}: ${table.body.slice(0, 200)}`);
    }
  } catch (error) {
    fail(`could not reach ${supabaseUrl}`, `Check SUPABASE_URL (looks like https://xxxx.supabase.co). ${error.cause?.code ?? error.message}`);
  }
}

console.log('\nRazorpay');
const keyId = env.RAZORPAY_KEY_ID;
const keySecret = env.RAZORPAY_KEY_SECRET;
if (!keyId || !keySecret) {
  fail('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set in .env.local');
} else {
  const mode = keyId.startsWith('rzp_live_') ? 'LIVE' : keyId.startsWith('rzp_test_') ? 'test' : 'unknown';
  const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
  });
  if (response.ok) ok(`keys accepted (${mode} mode${mode === 'LIVE' ? ' — real money will be charged' : ''})`);
  else if (response.status === 401) fail('Razorpay rejected the key ID / secret', 'Regenerate keys under Account & Settings → API Keys and copy both again.');
  else fail(`unexpected response ${response.status}: ${(await response.text()).slice(0, 200)}`);
}
env.RAZORPAY_WEBHOOK_SECRET
  ? ok('webhook secret set')
  : console.log('  • webhook secret not set yet (only needed once the site is deployed)');

console.log(failures ? `\n${failures} problem(s) to fix.\n` : '\nAll set. Restart `npm run dev` so the site picks up the keys.\n');
process.exit(failures ? 1 : 0);
