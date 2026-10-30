import Link from 'next/link';
import { ChevronRight, Download, FileUp, IndianRupee, Package, Users } from 'lucide-react';
import { formatFee } from '../../lib/eventData';
import { refundsDue, summary } from '../../lib/server/admin';
import { countOpenIssues } from '../../lib/server/issues';
import { requireAdmin } from '../../lib/server/adminAuth';
import { StaffBar } from './StaffBar';

const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

// Numbers only; the runner list lives on its own page (Runners) so the dashboard stays short as registrations grow.
export default async function AdminDashboard() {
  const staff = await requireAdmin();
  const [stats, refunds, openIssues] = await Promise.all([summary(), refundsDue(), countOpenIssues()]);
  const kitShare = stats.paid ? Math.round((stats.kits / stats.paid) * 100) : 0;

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Organiser dashboard" />

      <header className="adminHead">
        <div>
          <p className="adminHeadDate">{today()}</p>
          <h1>Hello, {staff.name.split(' ')[0]}</h1>
        </div>
        <div className="adminHeadActions">
          <Link className="button small outline" href="/admin/import"><FileUp size={15} /> Import</Link>
          <a className="button small" href="/admin/export"><Download size={15} /> Export CSV</a>
        </div>
      </header>

      <section className="adminStats" aria-label="Summary">
        <Stat label="Confirmed runners" value={stats.paid.toLocaleString('en-IN')} icon={<Users size={15} />} />
        <Stat label="Collected" value={`₹${stats.collected.toLocaleString('en-IN')}`} icon={<IndianRupee size={15} />} />
        <Stat label="Kits collected" value={`${stats.kits} / ${stats.paid}`} icon={<Package size={15} />} progress={kitShare} hint={stats.paid ? `${kitShare}% done` : 'At the expo'} />
      </section>
      <ul className="adminMiniStats" aria-label="More numbers">
        <MiniStat value={stats.unpaid} label="Started, not paid" hint="Removed after 7 days" href="/admin/registrations?status=unpaid" />
        <MiniStat value={stats.minors} label="Under 18" hint="Need a guardian" />
        <MiniStat value={refunds.length} label={refunds.length === 1 ? 'Refund due' : 'Refunds due'} hint="Refund in Razorpay" alert={refunds.length > 0} />
        {openIssues !== null && (
          <MiniStat value={openIssues} label={openIssues === 1 ? 'Open issue' : 'Open issues'} hint="Reported by runners" href="/admin/issues" alert={openIssues > 0} />
        )}
        {stats.cancelled > 0 && <MiniStat value={stats.cancelled} label="Cancelled" hint="Not counted above" href="/admin/registrations?status=cancelled" />}
      </ul>

      <section className="adminPanel">
        <h2>Runners and T-shirts by race</h2>
        <p className="adminHint">Paid runners only. Use the size totals to order kits. Tap a race to see its runners.</p>
        <div className="adminTableWrap">
          <table className="adminTable sizes">
            <thead>
              <tr><th>Race</th><th>Runners</th>{stats.sizes.map((size) => <th key={size}>{size}</th>)}</tr>
            </thead>
            <tbody>
              {stats.byRace.map((race) => (
                <tr key={race.slug}>
                  <td><Link href={`/admin/registrations?race=${race.slug}`}>{race.race}</Link></td>
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

      <p className="adminFoot">Entry fee {formatFee()} · Data is live from Supabase · Signed-in sessions last 12 hours</p>
    </main>
  );
}

/** A small number tile; red when it needs attention, a link when there is a list behind it. */
function MiniStat({ value, label, hint, href, alert }: { value: number; label: string; hint: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <b>{value.toLocaleString('en-IN')}</b>
      <span><strong>{label}</strong><small>{hint}</small></span>
      {href && <ChevronRight className="adminMiniArrow" size={16} aria-hidden="true" />}
    </>
  );
  return <li className={alert ? 'alert' : undefined}>{href ? <Link href={href}>{body}</Link> : <div>{body}</div>}</li>;
}

function Stat({ label, value, hint, icon, progress }: { label: string; value: number | string; hint?: string; icon: React.ReactNode; progress?: number }) {
  return (
    <div className="adminStat">
      <span>{icon} {label}</span>
      <b>{value}</b>
      {progress !== undefined && <i className="adminProgress" style={{ '--done': `${progress}%` } as React.CSSProperties} aria-hidden="true" />}
      {hint && <small>{hint}</small>}
    </div>
  );
}
