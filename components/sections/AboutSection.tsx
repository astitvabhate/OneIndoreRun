import Image from 'next/image';
import { MoveRight } from 'lucide-react';
import { photos } from './content';
import { Reveal } from './Reveal';

export function AboutSection() {
  return (
    <section id="about" className="aboutEditorial">
      <div className="aboutCopy">
        <Reveal>
          <h2><span className="nowrap">MORE THAN</span><br /><em>A RUN.</em></h2>
          <p className="aboutTagline">A movement to connect generations</p>
        </Reveal>
        <Reveal>
          <div className="copy">
            <p className="aboutLead">A movement to bring generations together and build a healthier, stronger and more united Indore.</p>
            <p>Citizens of every age and walk of life run together alongside the First Citizen of Indore, Hon&apos;ble Mayor Shri Pushyamitra Bhargav Ji.</p>
            <p className="aboutClosing">Together, we will celebrate the spirit of One United Indore.</p>
            <a href="#races" className="textLink"><span className="aboutArrow"><MoveRight /></span>Discover the distances</a>
          </div>
        </Reveal>
      </div>
      <div className="aboutVisual">
        <Image src={photos[7]} fill sizes="(max-width: 750px) 100vw, 58vw" alt="Runners of every generation moving through Indore" />
        <span className="aboutAccent" />
      </div>
    </section>
  );
}
