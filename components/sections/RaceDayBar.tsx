import Link from 'next/link';
import { ArrowDownRight } from 'lucide-react';
import { event, formatDateParts } from '../../lib/eventData';

const [kitStart, kitEnd] = event.expoDays;
const weekday = (iso: string) => formatDateParts(iso, { weekday: 'short' });

export function RaceDayBar() {
  return (
    <section className="racebar" aria-label="Race day and kit collection">
      <div className="racebarHalf">
        <span>Race day</span>
        <strong>{event.raceDate ? formatDateParts(event.raceDate, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : 'COMING SOON'}</strong>
        <p className="racebarMeta">{event.races.map((race) => race.distance).join(' · ')}</p>
        <Link href="/#route" className="racebarCta">Route<ArrowDownRight /></Link>
      </div>
      <div className="racebarHalf">
        <span>Kit collection</span>
        <strong>{formatDateParts(kitStart, { day: 'numeric' })} &amp; {formatDateParts(kitEnd, { day: 'numeric', month: 'short' }).toUpperCase()}</strong>
        <p className="racebarMeta">{weekday(kitStart)} &amp; {weekday(kitEnd)} · {event.kitCollectionHours ?? 'Timings TBA'}</p>
        <Link href="/#race-kit" className="racebarCta">Kit details<ArrowDownRight /></Link>
      </div>
    </section>
  );
}
