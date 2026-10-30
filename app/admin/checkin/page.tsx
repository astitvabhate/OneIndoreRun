import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { formatTime, fullName, raceLabel, regNoLabel, searchCheckIn, summary } from '../../../lib/server/admin';
import { requireStaff } from '../../../lib/server/adminAuth';
import { ticketIdFrom } from '../../../lib/ticketId';
import { StaffBar } from '../StaffBar';
import { QrScanner } from './QrScanner';

// Volunteers mask most of the mobile number; they can ask the runner to confirm it.
const maskMobile = (mobile: string) => `••••••${mobile.slice(-4)}`;

export default async function CheckIn({ searchParams }: { searchParams: Promise<{ q?: string; scan?: string }> }) {
  const staff = await requireStaff();
  const { q: query, scan } = await searchParams;
  // A USB/Bluetooth QR scanner types the ticket link into the search box and presses Enter.
  const scannedId = ticketIdFrom(query ?? '');
  if (scannedId) redirect(`/admin/checkin/${scannedId}`);
  const q = (query ?? '').trim().slice(0, 100);
  const [{ paid, kits: collected }, results] = await Promise.all([summary(), q.length >= 2 ? searchCheckIn(q) : []]);

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Kit check-in" />

      <section className="adminPanel checkinHero">
        <div>
          <h1>Kit check-in</h1>
          <p>Tap <b>Scan ticket QR</b>, hold the runner&apos;s ticket up to your phone or laptop camera and tap <b>Mark kit collected</b>. Check their photo ID matches the name.</p>
        </div>
        <div className="checkinCount"><b>{collected}</b><span>of {paid} kits collected</span></div>
        <QrScanner autoStart={scan === '1'} />
      </section>

      <section className="adminPanel">
        <h2>Runner forgot their ticket?</h2>
        <p className="adminHint">Search by OIRI number, mobile number or name, then tap them to check them in. A USB QR scanner also works here: click the box and scan.</p>
        <form className="adminFilters" method="get">
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={q} placeholder="OIRI-00012, 98765… or name" aria-label="Search runners" />
          </label>
          <button className="button small" type="submit">Search</button>
        </form>

        {q.length === 1 && <p className="adminHint">Type at least 2 characters to search.</p>}
        {q.length >= 2 && (
          <ul className="checkinResults">
            {results.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/checkin/${row.id}`}>
                  <span className="checkinName">{fullName(row)}<small>{regNoLabel(row)} · {raceLabel(row)} · T-shirt {row.tshirt_size} · {maskMobile(row.mobile)}</small></span>
                  {row.status === 'cancelled' ? <span className="pill cancelled">Cancelled</span>
                    : row.kit_collected_at ? <span className="pill">Collected {formatTime(row.kit_collected_at)}</span>
                    : <span className="pill paid">Waiting</span>}
                </Link>
              </li>
            ))}
            {results.length === 0 && <li className="adminEmpty">No paid runner matches “{q}”.</li>}
          </ul>
        )}
      </section>
    </main>
  );
}
