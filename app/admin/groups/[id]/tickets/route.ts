import { NextResponse } from 'next/server';
import { getStaff } from '../../../../../lib/server/adminAuth';
import { getOrganisation, organisationTickets, ticketsPerPdf } from '../../../../../lib/server/organisations';
import { renderTicketsPdf, siteOrigin, ticketUrl } from '../../../../../lib/server/ticket';

// A few hundred tickets take a while to draw.
export const maxDuration = 300;

// Paid runners' tickets for one organisation, a page each, as one PDF of up to ticketsPerPdf
// (?part=2 for the next batch). Organisers only.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await getStaff())?.role !== 'admin') return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const group = await getOrganisation((await params).id);
  if (!group) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const parts = Math.max(1, Math.ceil(group.runners / ticketsPerPdf));
  const part = Number(new URL(request.url).searchParams.get('part') ?? 1);
  if (!Number.isInteger(part) || part < 1 || part > parts) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const tickets = await organisationTickets(group.id, part);
    if (tickets.length === 0) return NextResponse.json({ error: 'no_tickets' }, { status: 404 });
    const origin = siteOrigin(request.headers);
    const label = parts > 1 ? ` (part ${part} of ${parts})` : '';
    const pdf = await renderTicketsPdf(tickets, (id) => ticketUrl(origin, id), `One Indore Run tickets: ${group.name}${label}`);
    const fileName = (group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group') + (parts > 1 ? `-part-${part}` : '');
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}-tickets.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Group tickets PDF failed', error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
