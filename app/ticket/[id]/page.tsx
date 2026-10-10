import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, CircleCheck, Download } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo } from '../../../lib/registrationSchema';
import { isRegistrationOpen } from '../../../lib/server/config';
import { getTicket } from '../../../lib/server/db';
import { paidOn, raceDayLabel, runnerName, siteOrigin, ticketQrSvg, ticketUrl } from '../../../lib/server/ticket';
import './ticket.css';

export const metadata: Metadata = { title: 'Race ticket | One Indore Run', robots: { index: false, follow: false } };

// Opened by the runner (to re-download) and by expo volunteers scanning the QR code.
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = isRegistrationOpen() ? await getTicket(id) : null;
  if (!ticket) notFound();

  const paid = ticket.status === 'paid';
  const qrSvg = paid ? await ticketQrSvg(ticketUrl(siteOrigin(await headers()), ticket.id)) : '';
  const details: [string, string][] = [
    ['Registration no.', formatRegNo(ticket.reg_no)],
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

      <article className="ticket">
        <div className={paid ? 'ticketStatus valid' : 'ticketStatus invalid'}>
          {paid ? <CircleCheck size={22} /> : <CircleAlert size={22} />}
          {paid ? 'VALID TICKET' : 'NOT PAID — NO KIT'}
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
            <p className="ticketNote">This registration has not been paid, so it does not include a race kit.</p>
          )}
          <p className="ticketNote">Bring this ticket and a photo ID to the Race Expo to collect your kit. Keep this page private — anyone with the link can see it.</p>
        </div>
      </article>
    </main>
  );
}
