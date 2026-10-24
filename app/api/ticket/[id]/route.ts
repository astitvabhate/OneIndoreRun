import { NextResponse } from 'next/server';
import { formatRegNo } from '../../../../lib/registrationSchema';
import { isPaymentConfigured } from '../../../../lib/server/config';
import { getTicket } from '../../../../lib/server/db';
import { renderTicketPdf, siteOrigin, ticketUrl } from '../../../../lib/server/ticket';

// Downloads the PDF ticket. Only paid registrations get one.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isPaymentConfigured()) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const ticket = await getTicket(id);
    if (!ticket || ticket.status !== 'paid') return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const pdf = await renderTicketPdf(ticket, ticketUrl(siteOrigin(request.headers), ticket.id));
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${formatRegNo(ticket.reg_no!)}-one-indore-run-ticket.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Ticket PDF failed', error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
