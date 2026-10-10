import Link from 'next/link';
import { Download, LogOut, RefreshCw, Search, Ticket } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { event, formatFee } from '../../lib/eventData';
import { ageOnRaceDay } from '../../lib/registrationSchema';
import {
  allRegistrations, applyFilters, formatDateTime, fullName, raceLabel, readFilters, refundsDue, regNoLabel, summarise,
  type AdminRegistration, type Filters,
} from '../../lib/server/admin';
import { requireAdmin } from '../../lib/server/adminAuth';
import { logout } from './actions';

const perPage = 50;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = readFilters(params);
  const page = Math.max(1, Number(params.page) || 1);

  const [rows, refunds] = await Promise.all([allRegistrations(), refundsDue()]);
  const stats = summarise(rows);
  const matches = applyFilters(rows, filters);
  const pages = Math.max(1, Math.ceil(matches.length / perPage));
  const shown = matches.slice((page - 1) * perPage, page * perPage);
  const query = (overrides: Partial<Filters> & { page?: number }) => {
    const next = new URLSearchParams();
    const merged = { ...filters, page, ...overrides };
    if (merged.q) next.set('q', merged.q);
    if (merged.race) next.set('race', merged.race);
    if (merged.status !== 'paid') next.set('status', merged.status);
    if (merged.page > 1) next.set('page', String(merged.page));
    const text = next.toString();
    return text ? `?${text}` : '';
  };

  return (
    <main className="adminPage">
      <header className="adminBar">
        <Logo />
        <span className="adminTitle">Organiser dashboard</span>
        <div className="adminBarActions">
          <Link href={`/admin${query({})}`} className="adminIconLink"><RefreshCw size={16} /> Refresh</Link>
          <form action={logout}><button type="submit" className="adminIconLink"><LogOut size={16} /> Sign out</button></form>
        </div>
      </header>

      <section className="adminStats" aria-label="Summary">
        <Stat label="Confirmed runners" value={stats.paid} />
        <Stat label="Collected" value={`₹${stats.collected.toLocaleString('en-IN')}`} />
        <Stat label="Started, not paid" value={stats.unpaid} hint="Opened checkout but haven't paid" />
        <Stat label="Under 18" value={stats.minors} hint="Paid runners needing a guardian" />
        <Stat label="Refunds due" value={refunds.length} tone={refunds.length ? 'alert' : undefined} hint={refunds.length ? 'See the list below' : 'None'} />
      </section>

      <section className="adminPanel">
        <h2>Runners and T-shirts by race</h2>
        <p className="adminHint">Paid runners only. Use the size totals to order kits.</p>
        <div className="adminTableWrap">
          <table className="adminTable sizes">
            <thead>
              <tr><th>Race</th><th>Runners</th>{stats.sizes.map((size) => <th key={size}>{size}</th>)}</tr>
            </thead>
            <tbody>
              {stats.byRace.map((race) => (
                <tr key={race.slug}>
                  <td><Link href={`/admin${query({ race: race.slug, page: 1 })}`}>{race.race}</Link></td>
                  <td><b>{race.total}</b></td>
                  {race.sizes.map((count, index) => <td key={stats.sizes[index]}>{count || '·'}</td>)}
                </tr>
              ))}
              <tr className="total">
                <td>Total</td><td>{stats.paid}</td>
                {stats.sizeTotals.map((count, index) => <td key={stats.sizes[index]}>{count}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {refunds.length > 0 && (
        <section className="adminPanel alert">
          <h2>Refunds due</h2>
          <p className="adminHint">These runners paid twice. Refund the second payment in Razorpay: Dashboard → Transactions → Payments → search the payment ID → Issue refund.</p>
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead><tr><th>Payment ID</th><th>Reg. no.</th><th>Runner</th><th>Mobile</th><th>Amount</th><th>Paid at</th></tr></thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.payment_id}>
                    <td><code>{refund.payment_id}</code></td>
                    <td>{refund.registration_number}</td>
                    <td>{refund.first_name} {refund.last_name}</td>
                    <td>{refund.mobile}</td>
                    <td>₹{refund.amount_inr}</td>
                    <td>{formatDateTime(refund.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="adminPanel">
        <div className="adminPanelHead">
          <h2>Registrations</h2>
          <a className="button small" href={`/admin/export${query({ page: 1 })}`}><Download size={15} /> Download CSV ({matches.length})</a>
        </div>

        <form className="adminFilters" method="get">
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={filters.q} placeholder="Name, mobile, email or OIR number" aria-label="Search" />
          </label>
          <select name="race" defaultValue={filters.race} aria-label="Race">
            <option value="">All races</option>
            {event.races.map((race) => <option key={race.slug} value={race.slug}>{race.distance}</option>)}
          </select>
          <select name="status" defaultValue={filters.status} aria-label="Payment status">
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
            <option value="all">All</option>
          </select>
          <button className="button small" type="submit">Apply</button>
          {(filters.q || filters.race || filters.status !== 'paid') && <Link href="/admin" className="adminClear">Clear</Link>}
        </form>

        <p className="adminHint">{matches.length} {matches.length === 1 ? 'registration' : 'registrations'}{pages > 1 && ` · page ${page} of ${pages}`}. Tap a name for full details.</p>

        <div className="adminTableWrap">
          <table className="adminTable list">
            <thead>
              <tr><th>Reg. no.</th><th>Runner</th><th>Race</th><th>T-shirt</th><th>Age</th><th>Mobile</th><th>Status</th><th>Paid / started</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((row) => <RegistrationRow key={row.id} row={row} />)}
              {shown.length === 0 && <tr><td colSpan={9} className="adminEmpty">No registrations match.</td></tr>}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="adminPager" aria-label="Pages">
            {page > 1 ? <Link href={`/admin${query({ page: page - 1 })}`}>← Previous</Link> : <span />}
            {page < pages ? <Link href={`/admin${query({ page: page + 1 })}`}>Next →</Link> : <span />}
          </nav>
        )}
      </section>

      <p className="adminFoot">Entry fee {formatFee()} · Data is live from Supabase · Signed-in sessions last 12 hours</p>
    </main>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: 'alert' }) {
  return (
    <div className={tone === 'alert' ? 'adminStat alert' : 'adminStat'}>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function RegistrationRow({ row }: { row: AdminRegistration }) {
  const paid = row.status === 'paid';
  const age = ageOnRaceDay(row.date_of_birth);
  const details: [string, string | null][] = [
    ['Email', row.email],
    ['Date of birth', `${row.date_of_birth} (${age} on race day)`],
    ['Gender', row.gender],
    ['Blood group', row.blood_group],
    ['Address', `${row.address}, ${row.city} – ${row.pincode}`],
    ['Occupation', row.occupation],
    ['Emergency contact', `${row.emergency_name} · ${row.emergency_mobile}`],
    ['Guardian', row.guardian_name ? `${row.guardian_name} · ${row.guardian_mobile}` : null],
    ['Photo consent', row.consent_media ? 'Yes' : 'No'],
    ['Payment ID', row.razorpay_payment_id],
    ['Started', formatDateTime(row.created_at)],
  ];

  return (
    <tr className={paid ? '' : 'unpaid'}>
      <td className="mono">{regNoLabel(row)}</td>
      <td>
        <details>
          <summary>{fullName(row)}</summary>
          <dl>{details.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </details>
      </td>
      <td>{raceLabel(row)}</td>
      <td>{row.tshirt_size}</td>
      <td className={age < 18 ? 'minor' : ''}>{age}</td>
      <td className="mono">{row.mobile}</td>
      <td><span className={paid ? 'pill paid' : 'pill'}>{paid ? 'Paid' : 'Not paid'}</span></td>
      <td>{formatDateTime(row.paid_at ?? row.created_at)}</td>
      <td>{paid && <a href={`/ticket/${row.id}`} target="_blank" rel="noopener" className="adminIconLink" aria-label={`Ticket for ${fullName(row)}`}><Ticket size={16} /></a>}</td>
    </tr>
  );
}
