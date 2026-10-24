import Link from 'next/link';
import { Search } from 'lucide-react';
import { activityPage, formatDateTime, historyActions, readActivityFilters, type ActivityEntry, type ActivityFilters } from '../../../lib/server/admin';
import { requireAdmin } from '../../../lib/server/adminAuth';
import { formatRegNo } from '../../../lib/registrationSchema';
import { HistoryDetails, historyLabels } from '../HistoryDetails';
import { StaffBar } from '../StaffBar';

const perPage = 50;

// Everything organisers and volunteers have done, newest first: who, when, to which runner, and what changed.
export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const filters = readActivityFilters(params);
  const page = Math.max(1, Number(params.page) || 1);
  const { rows, total } = await activityPage(filters, page, perPage);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const query = (overrides: Partial<ActivityFilters> & { page?: number }) => {
    const merged = { ...filters, page, ...overrides };
    const next = new URLSearchParams();
    if (merged.who) next.set('who', merged.who);
    if (merged.action) next.set('action', merged.action);
    if (merged.day) next.set('day', merged.day);
    if (merged.page > 1) next.set('page', String(merged.page));
    return next.size ? `?${next}` : '';
  };

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Activity" />

      <section className="adminPanel">
        <h1 className="activityTitle">Activity log</h1>
        <p className="adminHint">Every kit check-in, edit, cancellation and sign-in by organisers and volunteers. Entries cannot be changed or deleted from the website.</p>
        <form className="adminFilters" method="get">
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="who" defaultValue={filters.who} placeholder="Staff name" aria-label="Staff name" />
          </label>
          <select name="action" defaultValue={filters.action} aria-label="What">
            <option value="">Everything</option>
            {historyActions.map((action) => <option key={action} value={action}>{historyLabels[action]}</option>)}
          </select>
          <input type="date" name="day" defaultValue={filters.day} aria-label="Day" className="activityDay" />
          <button className="button small" type="submit">Apply</button>
          {(filters.who || filters.action || filters.day) && <Link href="/admin/activity" className="adminClear">Clear</Link>}
        </form>

        <p className="adminHint">{total.toLocaleString('en-IN')} {total === 1 ? 'entry' : 'entries'}{pages > 1 && ` · page ${page} of ${pages}`}.</p>

        <div className="adminTableWrap">
          <table className="adminTable activityTable">
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Runner</th><th>Details</th></tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.actor}</td>
                  <td><b>{historyLabels[entry.action]}</b></td>
                  <td><Runner entry={entry} /></td>
                  <td><HistoryDetails entry={entry} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="adminEmpty">No activity matches.</td></tr>}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="adminPager" aria-label="Pages">
            {page > 1 ? <Link href={`/admin/activity${query({ page: page - 1 })}`}>← Previous</Link> : <span />}
            {page < pages ? <Link href={`/admin/activity${query({ page: page + 1 })}`}>Next →</Link> : <span />}
          </nav>
        )}
      </section>
    </main>
  );
}

function Runner({ entry }: { entry: ActivityEntry }) {
  if (!entry.registration_id) return <>—</>;
  const registration = entry.registrations;
  const name = registration?.runners ? `${registration.runners.first_name} ${registration.runners.last_name}` : 'Runner';
  return (
    <Link href={`/admin/runner/${entry.registration_id}`}>
      {name}{registration?.reg_no ? ` · ${formatRegNo(registration.reg_no)}` : ''}
    </Link>
  );
}
