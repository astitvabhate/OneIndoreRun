import Link from 'next/link';
import { Building2, ChevronLeft, ChevronRight, Download, Pencil, RefreshCw, Search, Ticket, X } from 'lucide-react';
import { event } from '../../../lib/eventData';
import { ageOnRaceDay } from '../../../lib/registrationSchema';
import {
  formatDateTime, formatTime, fullName, raceLabel, readFilters, registrationsPage, regNoLabel,
  type AdminRegistration, type Filters,
} from '../../../lib/server/admin';
import { requireAdmin } from '../../../lib/server/adminAuth';
import { getOrganisation } from '../../../lib/server/organisations';
import { StaffBar } from '../StaffBar';

const perPage = 50;

export default async function Registrations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireAdmin();
  const params = await searchParams;
  const filters = readFilters(params);
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows: shown, total }, group] = await Promise.all([registrationsPage(filters, page, perPage), filters.org ? getOrganisation(filters.org) : null]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const query = (overrides: Partial<Filters> & { page?: number }) => {
    const next = new URLSearchParams();
    const merged = { ...filters, page, ...overrides };
    if (merged.q) next.set('q', merged.q);
    if (merged.race) next.set('race', merged.race);
    if (merged.status !== 'paid') next.set('status', merged.status);
    if (merged.kit) next.set('kit', merged.kit);
    if (merged.org) next.set('org', merged.org);
    if (merged.page > 1) next.set('page', String(merged.page));
    const text = next.toString();
    return text ? `?${text}` : '';
  };
  // Clear resets the search and filters but stays in the group; the chip's ✕ leaves the group.
  const filtered = Boolean(filters.q || filters.race || filters.kit || filters.status !== 'paid');
  const clearHref = `/admin/registrations${filters.org ? `?org=${filters.org}` : ''}`;

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Registrations" />

      <header className="adminHead">
        <div>
          <p className="adminHeadDate">Runners</p>
          <h1>Registrations</h1>
        </div>
        <div className="adminHeadActions">
          <a className="button small" href={`/admin/export${query({ page: 1 })}`}><Download size={15} /> Export CSV ({total.toLocaleString('en-IN')})</a>
        </div>
      </header>

      <section className="adminPanel">
        {group && (
          <p className="groupChip">
            <Building2 size={15} /> <span>Group: <Link href={`/admin/groups/${group.id}`}>{group.name}</Link></span>
            <Link href={`/admin/registrations${query({ org: '', page: 1 })}`} aria-label="Show all runners"><X size={15} /></Link>
          </p>
        )}
        <form className="adminFilters" method="get">
          {filters.org && <input type="hidden" name="org" value={filters.org} />}
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={filters.q} placeholder="Name, mobile, email or OIRI no." aria-label="Search" />
          </label>
          <select name="race" defaultValue={filters.race} aria-label="Race">
            <option value="">All races</option>
            {event.races.map((race) => <option key={race.slug} value={race.slug}>{race.distance}</option>)}
          </select>
          <select name="status" defaultValue={filters.status} aria-label="Payment status">
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <select name="kit" defaultValue={filters.kit} aria-label="Kit">
            <option value="">Any kit</option>
            <option value="waiting">Kit not collected</option>
            <option value="collected">Kit collected</option>
          </select>
          <button className="button small" type="submit">Apply</button>
          {filtered && <Link href={clearHref} className="adminClear">Clear</Link>}
        </form>

        <p className="adminCount">
          <b>{total.toLocaleString('en-IN')}</b> {total === 1 ? 'registration' : 'registrations'}{pages > 1 && ` · page ${page} of ${pages}`}
          <span> · Tap a name for full details</span>
          <Link href={`/admin/registrations${query({})}`} className="adminIconLink dark adminRefresh"><RefreshCw size={14} /> Refresh</Link>
        </p>

        <div className="adminTableWrap">
          <table className="adminTable list">
            <thead>
              <tr><th>Reg. no.</th><th>Runner</th><th>Race</th><th>T-shirt</th><th>Age</th><th>Mobile</th><th>Status</th><th>Kit</th><th>Paid / started</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((row) => <RegistrationRow key={row.id} row={row} />)}
              {shown.length === 0 && <tr className="emptyRow"><td colSpan={10} className="adminEmpty">No registrations match.</td></tr>}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="adminPager" aria-label="Pages">
            {page > 1 ? <Link href={`/admin/registrations${query({ page: page - 1 })}`}><ChevronLeft size={16} /> Previous</Link> : <span />}
            <span>{page} / {pages}</span>
            {page < pages ? <Link href={`/admin/registrations${query({ page: page + 1 })}`}>Next <ChevronRight size={16} /></Link> : <span />}
          </nav>
        )}
      </section>
    </main>
  );
}

function RegistrationRow({ row }: { row: AdminRegistration }) {
  const paid = row.status === 'paid';
  const cancelled = row.status === 'cancelled';
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
    ['Group', row.organisation],
    ['Payment ID', row.razorpay_payment_id],
    ['Started', formatDateTime(row.created_at)],
    ['Notes', row.admin_notes],
    ['Cancelled', cancelled ? `${formatDateTime(row.cancelled_at)}${row.cancel_reason ? ` — ${row.cancel_reason}` : ''}` : null],
  ];

  // On phones each row becomes a card; the class names place the cells (see .adminTable.list in admin.css).
  return (
    <tr className={paid ? '' : cancelled ? 'unpaid cancelled' : 'unpaid'}>
      <td className="cReg mono">{regNoLabel(row)}</td>
      <td className="cName">
        <details>
          <summary>{fullName(row)}</summary>
          <dl>{details.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </details>
      </td>
      <td className="cRace" data-label="Race">{raceLabel(row)}</td>
      <td className="cSize" data-label="T-shirt">{row.tshirt_size}</td>
      <td className={age < 18 ? 'cAge minor' : 'cAge'} data-label="Age">{age}</td>
      <td className="cMobile mono" data-label="Mobile"><a href={`tel:${row.mobile}`}>{row.mobile}</a></td>
      <td className="cStatus"><span className={paid ? 'pill paid' : cancelled ? 'pill cancelled' : 'pill'}>{paid ? 'Paid' : cancelled ? 'Cancelled' : 'Not paid'}</span></td>
      <td className="cKit" data-label="Kit">{row.kit_collected_at ? <span className="kitDone" title={`by ${row.kit_collected_by}`}>✓ {formatTime(row.kit_collected_at)}</span> : <span className="muted">—</span>}</td>
      <td className="cDate" data-label={row.paid_at ? 'Paid' : 'Started'}>{formatDateTime(row.paid_at ?? row.created_at)}</td>
      <td className="cActions rowActions">
        <Link href={`/admin/runner/${row.id}`} className="adminIconLink" aria-label={`Edit ${fullName(row)}`}><Pencil size={15} /><span className="adminActionText">Edit</span></Link>
        {(paid || cancelled) && <a href={`/ticket/${row.id}`} target="_blank" rel="noopener" className="adminIconLink" aria-label={`Ticket for ${fullName(row)}`}><Ticket size={16} /><span className="adminActionText">Ticket</span></a>}
      </td>
    </tr>
  );
}
