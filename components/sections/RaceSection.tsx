import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { event, formatFee } from '../../lib/eventData';
import { raceDescriptions, raceHighlights, raceImages } from './content';
import { Reveal } from './Reveal';

export function RaceSection() {
  return (
    <section id="races" className="raceSection">
      <div className="raceIntro">
        <Reveal><p className="eyebrow dark">Your pace. Your run.</p><h2>CHOOSE<br />YOUR <em>RUN.</em></h2></Reveal>
        <Reveal><p className="raceLead">Different distances. Same city spirit.<br />Pick your run and be part of One Indore Run. Whether it&apos;s your first 3K or a 10K challenge, there&apos;s a distance for every runner.</p></Reveal>
      </div>
      <div className="raceCardGrid">
        {event.races.map((race, index) => (
          <Reveal key={race.slug}>
            <article className="raceCard">
              <div className="raceCardPhoto">
                <Image src={raceImages[index]} fill sizes="(max-width: 750px) 100vw, 33vw" alt={`${race.distance} One Indore Run participants`} />
                <h3>{race.distance}</h3>
                <span>{raceHighlights[index]}</span>
              </div>
              <div className="raceCardBody">
                <h4>{race.label}</h4>
                <p>{raceDescriptions[index]}</p>
                <div>
                  <b>{formatFee()}</b>
                  <i />
                  <Link href={`/register?category=${race.slug}`}>Register now <ArrowUpRight size={16} /></Link>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
