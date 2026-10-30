import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Ticket } from 'lucide-react';
import { event, formatDateParts, formatFee } from '../../lib/eventData';
import { photos } from './content';
import { Reveal } from './Reveal';

const [kitStart, kitEnd] = event.expoDays;
const short = (iso: string) => formatDateParts(iso, { day: 'numeric', month: 'short' });

// Closing pitch: the key dates and fee in one glance, then register (or find an existing ticket).
export function FinalCallToAction() {
  const facts = [
    ...(event.raceDate ? [['Race day', short(event.raceDate)]] : []),
    ['Kit collection', `${formatDateParts(kitStart, { day: 'numeric' })}–${short(kitEnd)}`],
    ['Entry', formatFee()],
  ];
  return (
    <section className="final">
      <div className="finalVisual">
        <Image src={photos[9]} fill sizes="(max-width: 750px) 100vw, 55vw" alt="Runners charging off the start line at One Indore Run Indore" />
      </div>
      <div className="finalCopy">
        <Reveal>
          <p className="eyebrow">The starting line is yours</p>
          <h2>READY TO<br /><em>RUN INDORE?</em></h2>
          <p className="finalTagline">Your city. Your pace. Your run.</p>
          <dl className="finalFacts">
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <div className="finalActions">
            <Link href="/register" className="button">Register now <ArrowUpRight size={17} /></Link>
            <Link href="/ticket/find" className="button ghost"><Ticket size={16} /> Find my ticket</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
