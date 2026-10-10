import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, CircleCheck, Download, PackageCheck, Pencil, ScanLine } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo } from '../../../lib/registrationSchema';
import { getStaff, type Staff } from '../../../lib/server/adminAuth';
import { isRegistrationOpen } from '../../../lib/server/config';
import { getTicket, type TicketRow } from '../../../lib/server/db';
import { paidOn, raceDayLabel, runnerName, siteOrigin, ticketQrSvg, ticketUrl } from '../../../lib/server/ticket';
import { markKitCollected } from '../../admin/actions';
import './ticket.css';

export const metadata: Metadata = { title: 'Race ticket | One Indore Run', robots: { index: false, follow: false } };

const time = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// Opened by the runner (to re-download) and by expo staff scanning the QR code. Signed-in staff
// also get the kit check-in panel.
export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kit?: string }> }) {
  const { id } = await params;
  const { kit } = await searchParams;
  const ticket = isRegistrationOpen() ? await getTicket(id) : null;
  if (!ticket) notFound();
  const staff = await getStaff();

  const paid = ticket.status === 'paid';
  const cancelled = ticket.status === 'cancelled';
  const qrSvg = paid ? await ticketQrSvg(ticketUrl(siteOrigin(await headers()), ticket.id)) : '';
  const details: [string, string][] = [
    ['Registration no.', ticket.reg_no ? formatRegNo(ticket.reg_no) : '—'],
    ['T-shirt size', ticket.tshirt_size],
    ['Kit collection (Expo)', event.expoDates],
    ['Race day', raceDayLabel()],
    ['Payment ID', ticket.razorpay_payment_id ?? '—'],
    ['Paid on', paidOn(ticket)],
  ];

  return (
    <main className="ticketPage">
      <header className="regNav">
        <Logo />
        {staff ? <Link href="/admin/checkin" className="back"><ScanLine size={16} /> Check-in</Link> : <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>}
      </header>

      {staff && <KitPanel ticket={ticket} staff={staff} justDone={kit} />}

      <article className="ticket">
        <div className={paid ? 'ticketStatus valid' : 'ticketStatus invalid'}>
          {paid ? <CircleCheck size={22} /> : <CircleAlert size={22} />}
          {paid ? 'VALID TICKET' : cancelled ? 'CANCELLED — NO KIT' : 'NOT PAID — NO KIT'}
        </div>

        <div className="ticketBand">
          <div><span>Race</span><b>{findRace(ticket.category)?.distance ?? ticket.category}</b></div>
          <div><span>T-shirt</span><b>{ticket.tshirt_size}</b></div>
        </div>

        <div className="ticketBody">
          <span className="ticketLabel">Runner</span>
          <h1>{runnerName(ticket)}</h1>

          {/* SVG generated on our server by the qrcode library, not user input. */}
          {paid && <div className="ticketQr" aria-label="Ticket QR code" dangerouslySetInnerHTML={{ __html: qrSvg }} />}

          <dl>
            {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>

          {paid ? (
            <a className="button ticketDownload" href={`/api/ticket/${ticket.id}`} download>
              <Download size={17} /> Download ticket (PDF)
            </a>
          ) : (
            <p className="ticketNote">{cancelled ? 'This registration was cancelled by the organisers.' : 'This registration has not been paid, so it does not include a race kit.'}</p>
          )}
          <p className="ticketNote">Bring this ticket and a photo ID to the Race Expo to collect your kit. Keep this page private — anyone with the link can see it.</p>
        </div>
      </article>
    </main>
  );
}

/** What expo staff see at the top of a scanned ticket. */
function KitPanel({ ticket, staff, justDone }: { ticket: TicketRow; staff: Staff; justDone?: string }) {
  const race = findRace(ticket.category)?.distance ?? ticket.category;
  const handOver = `${race} kit · T-shirt ${ticket.tshirt_size}`;
  const edit = staff.role === 'admin' && <Link href={`/admin/runner/${ticket.id}`} className="kitEdit"><Pencil size={14} /> Edit runner</Link>;

  if (ticket.status !== 'paid') {
    return <section className="kitPanel stop" role="alert"><CircleAlert size={28} /><div><b>DO NOT HAND OVER A KIT</b><span>This ticket is {ticket.status === 'cancelled' ? 'cancelled' : 'not paid'}.</span>{edit}</div></section>;
  }
  if (ticket.kit_collected_at && justDone === 'collected') {
    return <section className="kitPanel done" role="status"><PackageCheck size={28} /><div><b>KIT COLLECTED ✓</b><span>Hand over: {handOver}</span>{edit}</div></section>;
  }
  if (ticket.kit_collected_at) {
    return (
      <section className="kitPanel stop" role="alert">
        <CircleAlert size={28} />
        <div><b>ALREADY COLLECTED</b><span>on {time(ticket.kit_collected_at)} by {ticket.kit_collected_by}. Do not hand over another kit.</span>{edit}</div>
      </section>
    );
  }
  return (
    <section className="kitPanel ready">
      <div><b>Kit not collected yet</b><span>Check photo ID, then hand over: {handOver}</span>{edit}</div>
      <form action={markKitCollected}>
        <input type="hidden" name="id" value={ticket.id} />
        <button type="submit" className="button kitButton"><PackageCheck size={20} /> Mark kit collected</button>
      </form>
    </section>
  );
}
