import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, CircleCheck, Download, ScanLine } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo } from '../../../lib/registrationSchema';
import { getStaff } from '../../../lib/server/adminAuth';
import { isPaymentConfigured } from '../../../lib/server/config';
import { getTicket } from '../../../lib/server/db';
import { paidOn, raceDayLabel, runnerName, siteOrigin, ticketQrSvg, ticketUrl } from '../../../lib/server/ticket';
import './ticket.css';

export const metadata: Metadata = { title: 'Race ticket | One Indore Run Indore', robots: { index: false, follow: false } };

// The runner's own ticket, always shown the same way. Kit check-in lives at /admin/checkin/<id>;
// staff who reach this page with their phone camera app just get a link there.
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = isPaymentConfigured() ? await getTicket(id) : null;
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
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      {staff && (
        <Link href={`/admin/checkin/${ticket.id}`} className="staffCheckinLink">
          <ScanLine size={18} /> Signed in as staff ({staff.name}) — open kit check-in for this runner
        </Link>
      )}

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
          <p className="ticketNote">Bring this ticket and a photo ID to the Race Expo to collect your kit.</p>
        </div>
      </article>
    </main>
  );
}