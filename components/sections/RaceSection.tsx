import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import { event, formatFee } from '../../lib/eventData';
import { raceDescriptions, raceImages, raceInclusions } from './content';
import { Reveal } from './Reveal';

export function RaceSection() {
  return (
    <section id="races" className="raceSection">
      <div className="raceIntro">
        <Reveal><h2>CHOOSE<br />YOUR <em>RUN.</em></h2></Reveal>
        <Reveal><p className="raceLead">Different distances. Same city spirit.<br />Pick your run and be part of One Indore Run Indore. Whether it&apos;s your first 3K or a 10K challenge, there&apos;s a distance for every runner.</p></Reveal>
      </div>
      <div className="raceCardGrid">
        {event.races.map((race, index) => (
          <Reveal key={race.slug}>
            <article className="raceCard">
              <div className="raceCardPhoto">
                <Image src={raceImages[index]} fill sizes="(max-width: 750px) 100vw, 33vw" alt={`${race.distance} One Indore Run Indore participants`} />
                <h3>{race.distance}</h3>
              </div>
              <div className="raceCardBody">
                <h4>{race.label}</h4>
                <p>{raceDescriptions[index]}</p>
                <ul className="raceChips">{raceInclusions.map((item) => <li key={item}>{item}</li>)}</ul>
                <div className="raceCardFoot">
                  <b>{formatFee()}</b>
                  <Link href={`/register?category=${race.slug}`}>Register now <ArrowUpRight size={16} /></Link>
                </div>
                <div className="raceAge"><Info size={13} /><span>Age {event.minAge}+ on race day. Under 18? Run with a parent or guardian.</span></div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
