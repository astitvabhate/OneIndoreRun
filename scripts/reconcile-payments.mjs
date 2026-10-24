// Compares Razorpay with the database and lists payments the database is missing: money taken
// that never got recorded (e.g. the browser closed and the webhook failed), and refunds that
// were never recorded. Read-only unless you pass --fix, which records them the same way the
// website does. Never prints secret values.
//
//   npm run reconcile                  last 3 days, report only
//   npm run reconcile -- --days 10     look further back
//   npm run reconcile -- --fix         also record what is missing

const env = process.env;
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const days = Number(args[args.indexOf('--days') + 1]) || 3;

for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) {
  if (!env[key]) {
    console.error(`${key} is not set in .env.local`);
    process.exit(1);
  }
}

const razorpayAuth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
const supabase = env.SUPABASE_URL.replace(/\/+$/, '');
const supabaseHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

async function call(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${url.split('?')[0]} → ${response.status} ${await response.text()}`);
  return response.json();
}

/** Every Razorpay payment created in the window, 100 at a time. */
async function razorpayPayments() {
  const from = Math.floor(Date.now() / 1000) - days * 86_400;
  const all = [];
  for (let skip = 0; ; skip += 100) {
    const page = await call(`https://api.razorpay.com/v1/payments?from=${from}&count=100&skip=${skip}`, { headers: { Authorization: razorpayAuth } });
    all.push(...page.items);
    if (page.items.length < 100) return all;
  }
}

/** Our payment rows for these order ids. */
async function ourRows(orderIds) {
  const rows = new Map();
  for (let i = 0; i < orderIds.length; i += 100) {
    const list = orderIds.slice(i, i + 100).map((id) => `"${id}"`).join(',');
    for (const row of await call(`${supabase}/rest/v1/payments?select=order_id,status,payment_id&order_id=in.(${list})`, { headers: supabaseHeaders })) {
      rows.set(row.order_id, row);
    }
  }
  return rows;
}

const rpc = (name, body) => call(`${supabase}/rest/v1/rpc/${name}`, { method: 'POST', headers: supabaseHeaders, body: JSON.stringify(body) });

console.log(`\nChecking Razorpay payments from the last ${days} day(s)${fix ? ' and fixing what is missing' : ''}…`);
const payments = (await razorpayPayments()).filter((payment) => payment.order_id);
const rows = await ourRows([...new Set(payments.map((payment) => payment.order_id))]);

let ok = 0;
let notOurs = 0;
const missing = [];
const unrecordedRefunds = [];
for (const payment of payments) {
  const row = rows.get(payment.order_id);
  if (!row) {
    notOurs++;
    continue;
  }
  const taken = payment.status === 'captured' || payment.status === 'refunded';
  const fullyRefunded = payment.amount_refunded >= payment.amount && payment.amount_refunded > 0;
  const recorded = row.payment_id === payment.id;
  if (taken && !recorded) missing.push(payment);
  else if (fullyRefunded && recorded && row.status !== 'refunded') unrecordedRefunds.push(payment);
  else ok++;
}

console.log(`  ✓ ${ok} payment(s) match the database`);
if (notOurs) console.log(`  • ${notOurs} payment(s) belong to orders this website didn't create (ignored)`);

for (const payment of missing) {
  console.log(`  ✗ captured but not recorded: ${payment.id} (order ${payment.order_id}, ₹${payment.amount / 100})`);
  if (fix) {
    const [result] = await rpc('mark_order_paid', { p_order_id: payment.order_id, p_payment_id: payment.id });
    console.log(`      → recorded: ${result?.outcome ?? 'unknown order'}`);
    if (payment.status === 'refunded') await rpc('mark_payment_refunded', { p_payment_id: payment.id, p_by: 'Reconcile script' });
  }
}
for (const payment of unrecordedRefunds) {
  console.log(`  ✗ refunded in Razorpay but not recorded: ${payment.id}`);
  if (fix) console.log(`      → ${await rpc('mark_payment_refunded', { p_payment_id: payment.id, p_by: 'Reconcile script' })}`);
}

const problems = missing.length + unrecordedRefunds.length;
if (!problems) console.log('\nEverything is recorded.\n');
else if (!fix) console.log(`\n${problems} problem(s). Run again with --fix to record them.\n`);
else console.log('\nDone. Check "Refunds due" on the dashboard for any payments that need refunding.\n');
