import Link from 'next/link';
import { ArrowDownRight, Map } from 'lucide-react';
import { event, formatDate, formatDateParts } from '../../lib/eventData';
import { ScratchReveal } from './ScratchReveal';

const [kitStart, kitEnd] = event.expoDays;

export function RaceDayBar() {
  const bar = (
    <section className="racebar" aria-label="Race day information">
      <div className="racebarItem racebarMain">
        <span>Race day</span>
        <strong>{event.raceDate ? formatDate(event.raceDate).toUpperCase() : 'COMING SOON'}</strong>
      </div>
      <div className="racebarItem racebarKit">
        <span>Kit collection</span>
        <b>{formatDateParts(kitStart, { day: 'numeric' })}–{formatDateParts(kitEnd, { day: 'numeric', month: 'short' })}</b>
      </div>
      <div className="racebarItem racebarDistances">
        <span>Distances</span>
        <b>{event.races.map((race) => race.distance).join(' · ')}</b>
      </div>
      {/* Jumps to the route map; desktop shows it as a button, phones as the original plain link. */}
      <Link href="/#route" className="racebarCta"><Map size={16} /><span className="racebarCtaWide">View route map</span><span className="racebarCtaNarrow">Route map</span><ArrowDownRight size={16} /></Link>
    </section>
  );
  // The whole bar is a scratch card once race day is announced; until then there's nothing to reveal.
  return event.raceDate ? <ScratchReveal hint="SCRATCH TO REVEAL RACE DAY">{bar}</ScratchReveal> : bar;
}
