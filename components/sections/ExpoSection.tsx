import { CalendarCheck } from 'lucide-react';
import { event, formatDateParts } from '../../lib/eventData';

const [kitStart, kitEnd] = event.expoDays;
const weekday = (iso: string) => formatDateParts(iso, { weekday: 'short' });

// Race day is the headline; kit collection gets a small reminder so the two dates aren't confused.
export function ExpoSection() {
  const raceDate = event.raceDate;
  return (
    <section className="expo wrap">
      <p className="eyebrow dark">Save the date · Race day</p>
      <div>
        <h2>SEE YOU AT THE<br /><em>START LINE.</em></h2>
        {raceDate && (
          <aside>
            <b>{formatDateParts(raceDate, { day: 'numeric' })}</b>
            <span>{formatDateParts(raceDate, { month: 'long' }).toUpperCase()} {formatDateParts(raceDate, { year: 'numeric' })}<br />{formatDateParts(raceDate, { weekday: 'long' }).toUpperCase()}</span>
          </aside>
        )}
      </div>
      <p className="expoNote">{event.races.map((race) => race.distance).join(' · ')} · Indore<br /><strong>Start times &amp; venue to be announced</strong></p>
      <p className="expoKit">
        <CalendarCheck size={16} />
        <span>Kit collection is <strong>before</strong> race day, on {formatDateParts(kitStart, { day: 'numeric' })} &amp; {formatDateParts(kitEnd, { day: 'numeric', month: 'long' })} ({weekday(kitStart)} &amp; {weekday(kitEnd)}). <a href="#experience">What&apos;s in the kit</a></span>
      </p>
    </section>
  );
}
