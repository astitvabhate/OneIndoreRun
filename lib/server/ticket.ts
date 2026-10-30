import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { event, findRace, formatDate } from '../eventData';
import { formatRegNo } from '../registrationSchema';
import type { TicketRow } from './db';
import { ticketLogoPng } from './ticketLogo';

/** Public site address: SITE_URL if set, otherwise whatever host the request came in on. */
export function siteOrigin(headers: Headers) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// The QR opens the ticket page, so expo volunteers can check it with any phone camera.
export const ticketUrl = (origin: string, id: string) => `${origin}/ticket/${id}`;

export const runnerName = (ticket: TicketRow) => [ticket.first_name, ticket.middle_name, ticket.last_name].filter(Boolean).join(' ');

export const paidOn = (ticket: TicketRow) =>
  ticket.paid_at ? new Date(ticket.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';

export const raceDayLabel = () => (event.raceDate ? formatDate(event.raceDate) : 'To be announced');

export const ticketQrSvg = (url: string) => QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#101613', light: '#ffffff' } });

const ink = rgb(16 / 255, 22 / 255, 19 / 255);
const lime = rgb(217 / 255, 250 / 255, 53 / 255);
const paper = rgb(242 / 255, 240 / 255, 233 / 255);
const muted = rgb(95 / 255, 101 / 255, 95 / 255);
const line = rgb(201 / 255, 204 / 255, 197 / 255);
const white = rgb(1, 1, 1);

// The built-in PDF fonts only cover Latin characters; anything else would make pdf-lib throw.
const pdfSafe = (text: string) => text.replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  return current ? [...lines, current] : lines;
}

/** Largest font size (down to a floor) at which the text fits on one line. */
function fitSize(text: string, font: PDFFont, size: number, maxWidth: number, min = 12) {
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

function label(page: PDFPage, font: PDFFont, text: string, x: number, y: number) {
  page.drawText(text.toUpperCase(), { x, y, size: 7.5, font, color: muted });
}

/** Fonts and logo, embedded once per PDF however many tickets it holds. */
async function ticketAssets(pdf: PDFDocument) {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    logo: await pdf.embedPng(Buffer.from(ticketLogoPng, 'base64')),
  };
}

/** The downloadable race ticket for one runner. */
export async function renderTicketPdf(ticket: TicketRow, url: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`One Indore Run Indore ticket ${formatRegNo(ticket.reg_no!)}`);
  pdf.setAuthor('One Indore Run Indore');
  await addTicketPage(pdf, await ticketAssets(pdf), ticket, url);
  return pdf.save();
}

/** Many tickets in one PDF, a page each, e.g. every runner of an organisation. */
export async function renderTicketsPdf(tickets: TicketRow[], urlFor: (id: string) => string, title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('One Indore Run Indore');
  const assets = await ticketAssets(pdf);
  for (const ticket of tickets) await addTicketPage(pdf, assets, ticket, urlFor(ticket.id));
  return pdf.save();
}

/** Draws one ticket page: header, race band, runner, QR code and kit details. */
async function addTicketPage(pdf: PDFDocument, { regular, bold, logo }: { regular: PDFFont; bold: PDFFont; logo: PDFImage }, ticket: TicketRow, url: string) {
  const regNo = formatRegNo(ticket.reg_no!); // only paid tickets, which always have a number
  const W = 420;
  const H = 760;
  const margin = 30;
  const page = pdf.addPage([W, H]);
  // 400 px stays sharp at the printed size and keeps a many-ticket PDF small (about 9 KB a page).
  const qr = await pdf.embedPng(await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, width: 400, color: { dark: '#101613', light: '#ffffff' } }));

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  // Header
  const headerH = 120;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: ink });
  const logoH = 74;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: margin - 6, y: H - headerH / 2 - logoH / 2, width: logoW, height: logoH });
  const rightText = (text: string, y: number, size: number, font: PDFFont, color = white) =>
    page.drawText(text, { x: W - margin - font.widthOfTextAtSize(text, size), y, size, font, color });
  rightText('INDORE 2.0', H - 52, 15, bold);
  rightText('DIGITAL RACE TICKET', H - 70, 8.5, bold, lime);

  // Race band
  const bandH = 70;
  const bandY = H - headerH - bandH;
  const race = findRace(ticket.category)?.distance ?? ticket.category;
  page.drawRectangle({ x: 0, y: bandY, width: W, height: bandH, color: lime });
  label(page, bold, 'Race', margin, bandY + bandH - 20);
  page.drawText(race, { x: margin, y: bandY + 16, size: 32, font: bold, color: ink });
  const regLabel = 'REGISTRATION NO.';
  page.drawText(regLabel, { x: W - margin - bold.widthOfTextAtSize(regLabel, 7.5), y: bandY + bandH - 20, size: 7.5, font: bold, color: muted });
  page.drawText(regNo, { x: W - margin - bold.widthOfTextAtSize(regNo, 22), y: bandY + 18, size: 22, font: bold, color: ink });

  // Runner
  const name = pdfSafe(runnerName(ticket)).toUpperCase();
  const nameSize = fitSize(name, bold, 22, W - margin * 2);
  label(page, bold, 'Runner', margin, bandY - 30);
  page.drawText(name, { x: margin, y: bandY - 56, size: nameSize, font: bold, color: ink });

  // QR code
  const qrSize = 206;
  const cardSize = qrSize + 24;
  const cardY = bandY - 82 - cardSize;
  page.drawRectangle({ x: (W - cardSize) / 2, y: cardY, width: cardSize, height: cardSize, color: white, borderColor: line, borderWidth: 1 });
  page.drawImage(qr, { x: (W - qrSize) / 2, y: cardY + 12, width: qrSize, height: qrSize });
  const scan = 'Show this QR code at the Race Expo kit counter';
  page.drawText(scan, { x: (W - regular.widthOfTextAtSize(scan, 9)) / 2, y: cardY - 16, size: 9, font: regular, color: muted });

  // Details: two columns, three rows
  const details: [string, string][] = [
    ['T-shirt size', ticket.tshirt_size],
    ticket.organisation ? ['Group entry', ticket.organisation] : ['Entry fee', `INR ${ticket.amount! / 100} - PAID`],
    ['Kit collection (Expo)', event.expoDates],
    ['Race day', raceDayLabel()],
    ['Payment ID', ticket.razorpay_payment_id ?? '—'],
    ['Paid on', paidOn(ticket)],
  ];
  const colW = (W - margin * 2) / 2;
  const top = cardY - 46;
  page.drawLine({ start: { x: margin, y: top + 18 }, end: { x: W - margin, y: top + 18 }, thickness: 1, color: line });
  details.forEach(([key, value], index) => {
    const x = margin + (index % 2) * colW;
    const y = top - Math.floor(index / 2) * 42;
    label(page, bold, key, x, y);
    const text = pdfSafe(value);
    page.drawText(text, { x, y: y - 16, size: fitSize(text, bold, 12, colW - 10, 8), font: bold, color: ink });
  });

  // Footer
  const footerH = 74;
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: ink });
  const note = 'Bring this ticket (printed or on your phone) and a photo ID to the Race Expo to collect your kit and bib. Venue and timings will be announced.';
  wrap(note, regular, 8.5, W - margin * 2).forEach((text, index) => {
    page.drawText(text, { x: margin, y: footerH - 22 - index * 12, size: 8.5, font: regular, color: white });
  });
  page.drawText(`Ticket ID ${ticket.id.slice(0, 8).toUpperCase()}`, { x: margin, y: 12, size: 7, font: regular, color: lime });
}
