import Image from 'next/image';
import { CalendarCheck, Check, Info } from 'lucide-react';
import { event, formatDate, formatDateParts } from '../../lib/eventData';
import { photos } from './content';
import { Reveal } from './Reveal';

const [kitStart, kitEnd] = event.expoDays;
const day = (iso: string) => formatDateParts(iso, { day: 'numeric' });
const weekday = (iso: string) => formatDateParts(iso, { weekday: 'short' });

export function KitSection() {
  return (
    <section id="race-kit" className="kit">
      <div className="kitVisual">
        <Image src={photos[1]} fill sizes="(max-width: 750px) 100vw, 50vw" alt="Runner enjoying their run" />
        <div className="kitTag">{event.kit.length}<span>ESSENTIALS</span></div>
      </div>
      <div className="kitContent">
        <Reveal>
          <h2>WHAT&apos;S IN<br />YOUR <em>RACE KIT?</em></h2>
          <p className="intro">For every 3 KM, 5 KM and 10 KM runner.</p>
          <ol className="kitGrid">
            {event.kit.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span>{item}<Check size={15} /></li>)}
          </ol>

          <div className="kitDates">
            <div className="kitDateMain">
              <span className="kitDateLabel"><CalendarCheck size={15} /> Kit collection</span>
              <b>{day(kitStart)}–{day(kitEnd)}</b>
              <span className="kitDateMonth">{formatDateParts(kitEnd, { month: 'long', year: 'numeric' }).toUpperCase()} · {weekday(kitStart).toUpperCase()} &amp; {weekday(kitEnd).toUpperCase()}</span>
              <small>Venue &amp; timings to be announced</small>
            </div>
            {event.raceDate && (
              <div className="kitDateRace">
                <span>Race day</span>
                <b>{formatDateParts(event.raceDate, { day: 'numeric', month: 'short' })}</b>
                <small>{formatDateParts(event.raceDate, { weekday: 'long' })}</small>
              </div>
            )}
          </div>
          <p className="kitDateNote"><Info size={16} /><span>Kit collection is <strong>before</strong> race day. Collect your kit on {day(kitStart)} or {formatDate(kitEnd)} and bring your bib on race day.</span></p>
        </Reveal>
      </div>
    </section>
  );
}
