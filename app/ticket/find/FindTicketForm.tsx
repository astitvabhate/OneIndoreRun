'use client';

import { useActionState } from 'react';
import { Search, Ticket } from 'lucide-react';
import { findMyTicket } from './actions';

export function FindTicketForm() {
  const [state, action, pending] = useActionState(findMyTicket, undefined);

  return (
    <>
      <form action={action} className="findForm">
        <label>
          Mobile number
          <input name="mobile" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" required />
        </label>
        <label>
          Date of birth
          <input name="dateOfBirth" type="date" min="1920-01-01" autoComplete="bday" required />
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Searching…' : <><Search size={17} /> Find my ticket</>}
        </button>
      </form>

      {state?.message && <p className="findError" role="alert">{state.message}</p>}
      {state?.tickets && (
        <ul className="findResults">
          {state.tickets.map((ticket) => (
            <li key={ticket.id}>
              <a href={`/ticket/${ticket.id}`}>
                <Ticket size={18} />
                <span><b>{ticket.name}</b><small>{ticket.regNo} · {ticket.race}{ticket.cancelled && ' · cancelled'}</small></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
