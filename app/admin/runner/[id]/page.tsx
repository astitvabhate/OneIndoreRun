import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Ban, PackageCheck, RotateCcw, Ticket, Undo2 } from 'lucide-react';
import { ageOnRaceDay } from '../../../../lib/registrationSchema';
import { formatDateTime, fullName, getRegistration, history, paymentAttempts, raceLabel, regNoLabel } from '../../../../lib/server/admin';
import { requireAdmin } from '../../../../lib/server/adminAuth';
import { cancelRegistration, markKitCollected, restoreRegistration, undoKitCheckIn } from '../../actions';
import { HistoryDetails, historyLabels } from '../../HistoryDetails';
import { StaffBar } from '../../StaffBar';
import { RunnerEditForm } from './RunnerEditForm';

const savedMessages: Record<string, string> = {
  details: 'Changes saved.',
  kit: 'Kit check-in undone. The runner can now collect their kit.',
  kit_collected: 'Kit marked as collected.',
  kit_already_collected: 'This kit had already been collected.',
  kit_not_paid: 'No kit: this registration is not paid.',
  cancelled: 'Registration cancelled. Refund the payment from the Razorpay dashboard if needed.',
  restored: 'Registration restored.',
};

const attemptLabels = { created: 'Opened, not paid', paid: 'Paid', failed: 'Failed', refund_due: 'Refund due', refunded: 'Refunded' };
const refundReasons = { duplicate: 'already paid', cancelled: 'registration cancelled', sold_out: 'race sold out' };

export default async function RunnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const staff = await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const row = await getRegistration(id);
  if (!row) notFound();
  const [attempts, log] = await Promise.all([paymentAttempts(row.id), history(row.id)]);
  const lastEdit = log.find((entry) => entry.action === 'edited');

  const statusLabel = { paid: 'Paid', pending: 'Not paid', cancelled: 'Cancelled' }[row.status];

  return (
    <main className="adminPage">
      <StaffBar staff={staff} title="Runner" />

      <section className="adminPanel runnerHead">
        <Link href="/admin/registrations" className="adminBack"><ArrowLeft size={15} /> All registrations</Link>
        <h1>{fullName(row)}</h1>
        <p>
          <span className="mono">{regNoLabel(row)}</span> · {raceLabel(row)} · T-shirt {row.tshirt_size} · age {ageOnRaceDay(row.date_of_birth)} on race day ·{' '}
          <span className={`pill ${row.status}`}>{statusLabel}</span>
        </p>
        {row.status !== 'pending' && (
          <a href={`/ticket/${row.id}`} target="_blank" rel="noopener" className="adminIconLink"><Ticket size={16} /> Open ticket</a>
        )}
        {saved && savedMessages[saved] && <p className="adminSaved" role="status">{savedMessages[saved]}</p>}
      </section>

      <div className="runnerGrid">
        <div>
          <section className="adminPanel">
            <h2>Details</h2>
            <p className="adminHint">
              {lastEdit ? `Last edited ${formatDateTime(lastEdit.created_at)} by ${lastEdit.actor}.` : 'Not edited since the runner registered.'}
            </p>
            <RunnerEditForm
              values={{
                id: row.id, firstName: row.first_name, middleName: row.middle_name ?? '', lastName: row.last_name, mobile: row.mobile,
                email: row.email, city: row.city, address: row.address, pincode: row.pincode, dateOfBirth: row.date_of_birth,
                gender: row.gender, bloodGroup: row.blood_group ?? '', occupation: row.occupation ?? '', category: row.category,
                tshirtSize: row.tshirt_size, emergencyName: row.emergency_name, emergencyMobile: row.emergency_mobile,
                guardianName: row.guardian_name ?? '', guardianMobile: row.guardian_mobile ?? '', adminNotes: row.admin_notes ?? '',
              }}
            />
          </section>
        </div>

        <aside>
          <section className="adminPanel">
            <h2>Race kit</h2>
            {row.kit_collected_at ? (
              <>
                <p className="kitState done"><PackageCheck size={18} /> Collected {formatDateTime(row.kit_collected_at)} by {row.kit_collected_by}</p>
                <form action={undoKitCheckIn}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" className="button small outline"><Undo2 size={15} /> Undo check-in</button>
                </form>
              </>
            ) : row.status === 'paid' ? (
              <>
                <p className="kitState">Not collected yet.</p>
                <form action={markKitCollected}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="from" value="runner" />
                  <button type="submit" className="button small"><PackageCheck size={15} /> Mark kit collected</button>
                </form>
              </>
            ) : (
              <p className="kitState">No kit: registration is {statusLabel.toLowerCase()}.</p>
            )}
          </section>

          <section className="adminPanel">
            <h2>Payment</h2>
            <dl className="adminFacts">
              {row.organisation_id && <div><dt>Group</dt><dd><Link href={`/admin/groups/${row.organisation_id}`}>{row.organisation}</Link></dd></div>}
              <div><dt>Amount paid</dt><dd>{row.amount === null ? '—' : `₹${row.amount / 100}`}</dd></div>
              <div><dt>Payment ID</dt><dd className="mono">{row.razorpay_payment_id ?? '—'}</dd></div>
              <div><dt>Paid at</dt><dd>{formatDateTime(row.paid_at)}</dd></div>
              <div><dt>First started</dt><dd>{formatDateTime(row.created_at)}</dd></div>
            </dl>
            <h3>Checkout attempts ({attempts.length})</h3>
            <ul className="attempts">
              {attempts.map((attempt) => (
                <li key={attempt.order_id} className={attempt.status}>
                  <span>{attemptLabels[attempt.status]}{attempt.refund_reason && ` — ${refundReasons[attempt.refund_reason]}`}</span>
                  <small className="mono">{attempt.order_id}{attempt.payment_id && ` · ${attempt.payment_id}`} · {formatDateTime(attempt.created_at)}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="adminPanel">
            <h2>History ({log.length})</h2>
            {log.length === 0 ? (
              <p className="adminHint">No changes by organisers or volunteers yet.</p>
            ) : (
              <ul className="attempts">
                {log.map((entry) => (
                  <li key={entry.id}>
                    <span>{historyLabels[entry.action]}</span>
                    <HistoryDetails entry={entry} />
                    <small>{entry.actor} · {formatDateTime(entry.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="adminPanel danger">
            {row.status === 'cancelled' ? (
              <>
                <h2>Cancelled</h2>
                <p className="adminHint">{formatDateTime(row.cancelled_at)}{row.cancel_reason && ` — ${row.cancel_reason}`}</p>
                <form action={restoreRegistration}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" className="button small"><RotateCcw size={15} /> Restore registration</button>
                </form>
              </>
            ) : (
              <>
                <h2>Cancel registration</h2>
                <p className="adminHint">The ticket stops working and no kit can be collected. This does not refund the payment; do that in Razorpay.</p>
                <form action={cancelRegistration} className="cancelForm">
                  <input type="hidden" name="id" value={row.id} />
                  <input name="reason" placeholder="Reason (e.g. runner asked to withdraw)" maxLength={300} />
                  <label><input type="checkbox" required /> I want to cancel {row.first_name}&apos;s registration</label>
                  <button type="submit" className="button small danger"><Ban size={15} /> Cancel registration</button>
                </form>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
