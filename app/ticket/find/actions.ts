'use server';

import { headers } from 'next/headers';
import { findRace, isValidDate } from '../../../lib/eventData';
import { formatRegNo } from '../../../lib/registrationSchema';
import { isPaymentConfigured } from '../../../lib/server/config';
import { findTickets } from '../../../lib/server/db';
import { clientIp, withinLimits } from '../../../lib/server/rateLimit';

export type FoundTicket = { id: string; name: string; regNo: string; race: string; cancelled: boolean };
export type FindState = { tickets?: FoundTicket[]; message?: string } | undefined;

/** Looks up a runner's tickets by the mobile number and date of birth they registered with. */
export async function findMyTicket(_previous: FindState, formData: FormData): Promise<FindState> {
  const mobile = String(formData.get('mobile') ?? '').trim();
  const dateOfBirth = String(formData.get('dateOfBirth') ?? '');
  if (!/^[6-9]\d{9}$/.test(mobile) || !isValidDate(dateOfBirth)) {
    return { message: 'Please enter the 10-digit mobile number and date of birth you registered with.' };
  }
  if (!isPaymentConfigured()) return { message: 'Ticket lookup is not available yet.' };

  // Guessing someone's details should be slow.
  const allowed = await withinLimits([
    { key: `find:ip:${clientIp(await headers())}`, max: 20, windowSeconds: 600 },
    { key: `find:mobile:${mobile}`, max: 10, windowSeconds: 3600 },
  ]);
  if (!allowed) return { message: 'Too many searches. Please wait a few minutes and try again.' };

  try {
    const rows = await findTickets(mobile, dateOfBirth);
    if (rows.length === 0) {
      return { message: 'No paid registration matches these details. Check them, or register if you haven’t paid yet.' };
    }
    return {
      tickets: rows.map((row) => ({
        id: row.id,
        name: `${row.first_name} ${row.last_name}`,
        regNo: row.reg_no ? formatRegNo(row.reg_no) : '—',
        race: findRace(row.category)?.distance ?? row.category,
        cancelled: row.status === 'cancelled',
      })),
    };
  } catch (error) {
    console.error('Ticket lookup failed', error);
    return { message: 'We could not look that up right now. Please try again in a minute.' };
  }
}
