import Image from 'next/image';
import { Reveal } from './Reveal';

export function RouteSection() {
  return (
    <section id="route" className="route wrap">
      <Reveal>
        <p className="eyebrow dark">Run the streets of Indore</p>
        <h2>THE ROUTE<br /><em>AWAITS.</em></h2>
        <div className="routeMap">
          <Image src="/assets/route-map.png" fill sizes="(max-width: 750px) 100vw, 84vw" alt="One Indore Run Indore 10 kilometre route map" />
        </div>
        <p className="routeNote">Explore the complete 10 KM route, including landmarks, support points and race directions.</p>
      </Reveal>
    </section>
  );
}
