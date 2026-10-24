import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CircleAlert, PackageCheck, Pencil, ScanLine } from 'lucide-react';
import { ageOnRaceDay } from '../../../../lib/registrationSchema';
import { formatTime, fullName, getRegistration, raceLabel, regNoLabel, type AdminRegistration } from '../../../../lib/server/admin';
import { requireStaff, type Staff } from '../../../../lib/server/adminAuth';
import { markKitCollected } from '../../actions';
import { StaffBar } from '../../StaffBar';

// Volunteers mask most of the mobile number; they can ask the runner to confirm it.
const maskMobile = (mobile: string) => `••••••${mobile.slice(-4)}`;

// Where a scanned ticket lands for staff: the runner's details and the kit hand-over button.
// The public ticket page (/ticket/<id>) never shows any of this.
export default async function CheckInRunner({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kit?: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const { kit } = await searchParams;
  const row = await getRegistration(id);
  if (!row) notFound();

  const facts: [string, string][] = [
    ['Registration no.', regNoLabel(row)],
    ['Race', raceLabel(row)],
    ['T-shirt', row.tshirt_size],
    ['Gender', row.gender],
    ['Age on race day', String(ageOnRaceDay(row.date_of_birth))],
    ['Mobile', staff.role === 'admin' ? row.mobile : maskMobile(row.mobile)],
  ];

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Kit check-in" />

      <KitPanel row={row} staff={staff} justDone={kit} />

      <section className="adminPanel checkinRunner">
        <span className="adminHint">Runner — check photo ID matches</span>
        <h1>{fullName(row)}</h1>
        <dl className="adminFacts">
          {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>

      <div className="checkinNext">
        <Link href="/admin/checkin?scan=1" className="button kitButton"><ScanLine size={20} /> Scan next ticket</Link>
      </div>
    </main>
  );
}

function KitPanel({ row, staff, justDone }: { row: AdminRegistration; staff: Staff; justDone?: string }) {
  const handOver = `${raceLabel(row)} kit · T-shirt ${row.tshirt_size}`;
  const edit = staff.role === 'admin' && <Link href={`/admin/runner/${row.id}`} className="kitEdit"><Pencil size={14} /> Open runner record</Link>;

  if (row.status !== 'paid') {
    return <section className="kitPanel stop" role="alert"><CircleAlert size={28} /><div><b>DO NOT HAND OVER A KIT</b><span>This registration is {row.status === 'cancelled' ? 'cancelled' : 'not paid'}.</span>{edit}</div></section>;
  }
  if (row.kit_collected_at && justDone === 'collected') {
    return <section className="kitPanel done" role="status"><PackageCheck size={28} /><div><b>KIT COLLECTED ✓</b><span>Hand over: {handOver}</span>{edit}</div></section>;
  }
  if (row.kit_collected_at) {
    return (
      <section className="kitPanel stop" role="alert">
        <CircleAlert size={28} />
        <div><b>ALREADY COLLECTED</b><span>on {formatTime(row.kit_collected_at)} by {row.kit_collected_by}. Do not hand over another kit.</span>{edit}</div>
      </section>
    );
  }
  return (
    <section className="kitPanel ready">
      <div><b>Kit not collected yet</b><span>Check photo ID, then hand over: {handOver}</span>{edit}</div>
      <form action={markKitCollected}>
        <input type="hidden" name="id" value={row.id} />
        <button type="submit" className="button kitButton"><PackageCheck size={20} /> Mark kit collected</button>
      </form>
    </section>
  );
}
