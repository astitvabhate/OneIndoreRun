import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { event } from '../../lib/eventData';
import { photos } from './content';

// Server-rendered so the headline paints immediately; the entrance animation is pure CSS.
export function HeroSection() {
  return (
    <section className="hero">
      <Image src={photos[0]} fill priority sizes="100vw" alt="Runners on a city road" />
      <div className="heroShade" />
      <div className="heroContent">
        <p className="eyebrow">One Indore Run <i /> Indore 2.0</p>
        <h1>RUN INDORE.<br /><em>FEEL ALIVE.</em></h1>
        <div className="heroBottom">
          <div className="heroMeta">
            <p>RUN · COMMUNITY · CITY · ENERGY</p>
            <p className="heroDistances">{event.races.map((race) => race.distance).join('  |  ')}</p>
            <p className="heroPlace"><MapPin size={15} /> Indore, Madhya Pradesh</p>
          </div>
          <div className="heroActions">
            <Link className="button" href="/register">Register now <ArrowUpRight size={17} /></Link>
            <a className="button ghost" href="#races">Explore races</a>
          </div>
        </div>
      </div>
    </section>
  );
}
