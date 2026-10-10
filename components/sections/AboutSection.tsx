import Image from 'next/image';
import { MoveRight } from 'lucide-react';
import { photos } from './content';
import { Reveal } from './Reveal';

export function AboutSection() {
  return <section id="about" className="aboutEditorial"><div className="aboutCopy"><Reveal><p className="eyebrow dark">Built to move together</p><h2>MORE THAN<br /><em>A RUN.</em></h2></Reveal><Reveal><div className="copy"><p>One Indore Run turns a morning on the streets into a shared city moment. A place for every pace, every first finish line, and every reason to show up.</p><p>Come for the distance. Leave with the energy of Indore running beside you.</p><a href="#races" className="textLink"><span className="aboutArrow"><MoveRight /></span>Discover the distances</a></div></Reveal></div><div className="aboutVisual"><Image src={photos[7]} fill sizes="(max-width: 750px) 100vw, 58vw" alt="Runners moving through Indore" /><span className="aboutAccent" /></div></section>;
}
