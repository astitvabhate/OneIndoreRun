// Ticket QR codes hold `<site>/ticket/<uuid>`. We only keep the id, so a code printed with a
// different host (staging, localhost) still opens the ticket on this site.
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ticketPath = new RegExp(`/ticket/(${uuid})(?:[/?#]|$)`, 'i');
const bareId = new RegExp(`^(${uuid})$`, 'i');

/** The ticket id in a scanned QR code, pasted link or bare id; null for anything else. */
export const ticketIdFrom = (text: string) => (text.trim().match(ticketPath) ?? text.trim().match(bareId))?.[1].toLowerCase() ?? null;
