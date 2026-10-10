import Link from 'next/link';
import { Search } from 'lucide-react';
import { allRegistrations, formatTime, fullName, matchesSearch, raceLabel, regNoLabel } from '../../../lib/server/admin';
import { requireStaff } from '../../../lib/server/adminAuth';
import { StaffBar } from '../StaffBar';

// Volunteers mask most of the mobile number; they can ask the runner to confirm it.
const maskMobile = (mobile: string) => `••••••${mobile.slice(-4)}`;

export default async function CheckIn({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaff();
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const rows = await allRegistrations();
  const paid = rows.filter((row) => row.status === 'paid');
  const collected = paid.filter((row) => row.kit_collected_at).length;
  const results = q.length >= 2 ? rows.filter((row) => (row.status === 'paid' || row.status === 'cancelled') && matchesSearch(row, q)).slice(0, 30) : [];

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Kit check-in" />

      <section className="adminPanel checkinHero">
        <div>
          <h1>Kit check-in</h1>
          <p>Open your phone camera, scan the runner&apos;s ticket QR code and tap <b>Mark kit collected</b>. Check their photo ID matches the name.</p>
        </div>
        <div className="checkinCount"><b>{collected}</b><span>of {paid.length} kits collected</span></div>
      </section>

      <section className="adminPanel">
        <h2>Runner forgot their ticket?</h2>
        <p className="adminHint">Search by OIR number, mobile number or name, then open their ticket to check them in.</p>
        <form className="adminFilters" method="get">
          <label className="adminSearch">
            <Search size={16} />
            <input type="search" name="q" defaultValue={q} placeholder="OIR-00012, 98765… or name" aria-label="Search runners" autoFocus />
          </label>
          <button className="button small" type="submit">Search</button>
        </form>

        {q.length === 1 && <p className="adminHint">Type at least 2 characters to search.</p>}
        {q.length >= 2 && (
          <ul className="checkinResults">
            {results.map((row) => (
              <li key={row.id}>
                <Link href={`/ticket/${row.id}`}>
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
