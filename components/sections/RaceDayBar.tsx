import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { event, formatFee } from '../../lib/eventData';

export function RaceDayBar() {
  return (
    <section className="racebar" aria-label="Race day information">
      <span>RACE DAY</span>
      <strong>{event.raceDay ?? 'COMING SOON'}</strong>
      <i aria-hidden="true" />
      <span>{event.races.map((race) => race.distance).join(' · ')}</span>
      <Link href="/register">ENTRY {formatFee()} <ArrowUpRight size={15} /></Link>
    </section>
  );
}
