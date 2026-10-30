import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, FileUp, IndianRupee, Package, PackageCheck, Phone, Users } from 'lucide-react';
import { requireAdmin } from '../../../../lib/server/adminAuth';
import { getOrganisation, ticketsPerPdf } from '../../../../lib/server/organisations';
import { formatDateTime } from '../../../../lib/server/admin';
import { collectGroupKits } from '../../actions';
import { StaffBar } from '../../StaffBar';

export default async function Group({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kits?: string }> }) {
  const staff = await requireAdmin();
  const [{ id }, { kits: marked }] = await Promise.all([params, searchParams]);
  const group = await getOrganisation(id);
  if (!group) notFound();
  const waiting = group.runners - group.kits;
  const kitShare = group.runners ? Math.round((group.kits / group.runners) * 100) : 0;
  // Big groups download in batches, e.g. tickets 1–200 and 201–350.
  const parts = Array.from({ length: Math.ceil(group.runners / ticketsPerPdf) }, (_, index) => ({
    part: index + 1,
    first: index * ticketsPerPdf + 1,
    last: Math.min((index + 1) * ticketsPerPdf, group.runners),
  }));

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Groups" />

      <header className="adminHead">
        <div>
          <Link href="/admin/groups" className="adminBack pageBack"><ArrowLeft size={15} /> All groups</Link>
          <h1>{group.name}</h1>
          <p className="groupContact">
            {group.contact_name ?? 'No contact person'}
            {group.contact_mobile && <a href={`tel:${group.contact_mobile}`}><Phone size={13} /> {group.contact_mobile}</a>}
            <span>Added {formatDateTime(group.created_at)}</span>
          </p>
        </div>
      </header>

      {marked !== undefined && (
        <p className="adminSaved" role="status">
          {Number(marked) > 0 ? `${marked} kit${marked === '1' ? '' : 's'} marked collected.` : 'Every kit was already collected; nothing changed.'}
        </p>
      )}

      <section className="adminStats" aria-label="Summary">
        <div className="adminStat"><span><Users size={15} /> Runners</span><b>{group.runners}</b><small>Paid registrations</small></div>
        <div className="adminStat">
          <span><Package size={15} /> Kits collected</span>
          <b>{group.kits} / {group.runners}</b>
          <i className="adminProgress" style={{ '--done': `${kitShare}%` } as React.CSSProperties} aria-hidden="true" />
          <small>{waiting > 0 ? `${waiting} still to hand over` : group.runners ? 'All handed over' : 'No runners yet'}</small>
        </div>
        <div className="adminStat"><span><IndianRupee size={15} /> Received</span><b>₹{(group.amount_paise / 100).toLocaleString('en-IN')}</b><small>Recorded at import</small></div>
      </section>

      <section className="groupActions">
        <div className="adminPanel">
          <h2>QR tickets</h2>
          <p className="adminHint">
            Every runner&apos;s ticket, a page each, in number order. Print it or send it to the organisation; each QR works at the expo kit counter.
            {parts.length > 1 && ` Big groups come in files of up to ${ticketsPerPdf} tickets.`}
          </p>
          <div className="importActions">
            {parts.length === 0 && <span className="adminHint">No paid runners yet.</span>}
            {parts.length === 1 && <a className="button small" href={`/admin/groups/${group.id}/tickets`}><Download size={15} /> Download {group.runners} tickets (PDF)</a>}
            {parts.length > 1 && parts.map(({ part, first, last }) => (
              <a key={part} className="button small" href={`/admin/groups/${group.id}/tickets?part=${part}`}><Download size={15} /> Tickets {first}–{last}</a>
            ))}
            <Link className="button small outline" href={`/admin/registrations?org=${group.id}`}><Users size={15} /> View runners</Link>
            <Link className="button small outline" href={`/admin/import?group=${group.id}`}><FileUp size={15} /> Add runners</Link>
          </div>
        </div>

        <div className="adminPanel">
          <h2>Kits sent to the organisation</h2>
          {waiting > 0 ? (
            <form action={collectGroupKits} className="cancelForm">
              <input type="hidden" name="id" value={group.id} />
              <p className="adminHint">When the kits are delivered to {group.name} before the expo, mark them all collected at once. Their QR codes will then show the kit as already collected at the counter.</p>
              <label>
                <input type="checkbox" name="confirm" required />
                The {waiting} remaining kit{waiting === 1 ? ' has' : 's have'} been handed to {group.contact_name ?? group.name}.
              </label>
              <button className="button small" type="submit"><PackageCheck size={15} /> Mark {waiting} kit{waiting === 1 ? '' : 's'} collected</button>
            </form>
          ) : (
            <p className="kitState done"><CheckCircle2 size={18} /> {group.runners ? 'Every kit has been collected.' : 'No runners yet.'}</p>
          )}
        </div>
      </section>
    </main>
  );
}
