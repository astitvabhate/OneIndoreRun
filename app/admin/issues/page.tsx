import Link from 'next/link';
import { CheckCircle2, ChevronLeft, ChevronRight, Mail, Phone, RotateCcw, Search } from 'lucide-react';
import { formatDateTime } from '../../../lib/server/admin';
import { requireAdmin } from '../../../lib/server/adminAuth';
import { countOpenIssues, issueCategories, listIssues, type Issue, type IssueStatus } from '../../../lib/server/issues';
import { reopenReportedIssue, resolveReportedIssue } from '../actions';
import { StaffBar } from '../StaffBar';

const perPage = 30;
const tabs: [IssueStatus | 'all', string][] = [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']];

export default async function Issues({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const status = tabs.some(([key]) => key === params.status) ? (params.status as IssueStatus | 'all') : 'open';
  const q = (params.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);

  const [{ issues, total }, open] = await Promise.all([listIssues(status, q, page, perPage), countOpenIssues()]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const href = (overrides: { status?: string; page?: number }) => {
    const next = new URLSearchParams();
    const merged = { status, q, page, ...overrides };
    if (merged.status !== 'open') next.set('status', merged.status);
    if (merged.q) next.set('q', merged.q);
    if (merged.page > 1) next.set('page', String(merged.page));
    const text = next.toString();
    return `/admin/issues${text ? `?${text}` : ''}`;
  };

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Issues" />

      <header className="adminHead">
        <div>
          <p className="adminHeadDate">Reported by runners</p>
          <h1>Issues</h1>
        </div>
      </header>

      <section className="adminPanel">
        <p className="adminHint">Sent from the website&apos;s Help page (<Link href="/help" target="_blank">/help</Link>). Fix the problem (in Razorpay or on the runner&apos;s page), call or message the runner, then mark it resolved with a note of what you did.</p>

        <nav className="issueTabs" aria-label="Status">
          {tabs.map(([key, label]) => (
            <Link key={key} href={href({ status: key, page: 1 })} className={key === status ? 'active' : undefined} aria-current={key === status ? 'page' : undefined}>
              {label}{key === 'open' && open !== null && <b>{open}</b>}
            </Link>
          ))}
        </nav>

        <form className="adminFilters" method="get">
          {status !== 'open' && <input type="hidden" name="status" value={status} />}
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={q} placeholder="Name, mobile, OIRI no., payment ID or #reference" aria-label="Search issues" />
          </label>
          <button className="button small" type="submit">Search</button>
          {q && <Link href={status === 'open' ? '/admin/issues' : `/admin/issues?status=${status}`} className="adminClear">Clear</Link>}
        </form>

        {issues.length === 0 ? (
          <p className="adminEmpty">{q ? 'No issue matches.' : status === 'open' ? 'Nothing waiting. 🎉' : 'No issues yet.'}</p>
        ) : (
          <ul className="issueList">{issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</ul>
        )}

        {pages > 1 && (
          <nav className="adminPager" aria-label="Pages">
            {page > 1 ? <Link href={href({ page: page - 1 })}><ChevronLeft size={16} /> Previous</Link> : <span />}
            <span>{page} / {pages}</span>
            {page < pages ? <Link href={href({ page: page + 1 })}>Next <ChevronRight size={16} /></Link> : <span />}
          </nav>
        )}
      </section>
    </main>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const resolved = issue.status === 'resolved';
  const regSearch = issue.reg_no ? `/admin/registrations?status=all&q=${encodeURIComponent(issue.reg_no)}` : `/admin/registrations?status=all&q=${issue.mobile}`;
  return (
    <li className={resolved ? 'issueCard resolved' : 'issueCard'}>
      <div className="issueTop">
        <span className="issueRef">#{issue.id}</span>
        <span className={`pill issueCat ${issue.category}`}>{issueCategories[issue.category]}</span>
        <span className="issueWhen">{formatDateTime(issue.created_at)}</span>
        {resolved && <span className="pill paid">Resolved</span>}
      </div>

      <p className="issueMessage">{issue.message}</p>

      <dl className="issueFacts">
        <div><dt>Runner</dt><dd>{issue.name}</dd></div>
        <div><dt>Mobile</dt><dd><a href={`tel:${issue.mobile}`}><Phone size={13} /> {issue.mobile}</a></dd></div>
        {issue.email && <div><dt>Email</dt><dd><a href={`mailto:${issue.email}?subject=${encodeURIComponent(`One Indore Run: your issue #${issue.id}`)}`}><Mail size={13} /> {issue.email}</a></dd></div>}
        {issue.reg_no && <div><dt>Reg. no.</dt><dd className="mono">{issue.reg_no}</dd></div>}
        {issue.payment_ref && <div><dt>Payment ID</dt><dd className="mono">{issue.payment_ref}</dd></div>}
      </dl>
      <Link href={regSearch} className="adminIconLink dark issueLookup"><Search size={14} /> Find this runner</Link>

      {resolved ? (
        <div className="issueResolution">
          <p><CheckCircle2 size={15} /> Resolved by {issue.resolved_by} · {formatDateTime(issue.resolved_at)}</p>
          {issue.resolution && <p className="issueNote">{issue.resolution}</p>}
          <form action={reopenReportedIssue}>
            <input type="hidden" name="id" value={issue.id} />
            <button type="submit" className="adminIconLink dark"><RotateCcw size={14} /> Reopen</button>
          </form>
        </div>
      ) : (
        <form action={resolveReportedIssue} className="issueResolve">
          <input type="hidden" name="id" value={issue.id} />
          <input name="resolution" maxLength={500} placeholder="What did you do? e.g. Payment confirmed, ticket sent on WhatsApp" aria-label={`Resolution for issue ${issue.id}`} />
          <button className="button small" type="submit"><CheckCircle2 size={15} /> Mark resolved</button>
        </form>
      )}
    </li>
  );
}
