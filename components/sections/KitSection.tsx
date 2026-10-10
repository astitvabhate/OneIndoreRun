import Image from 'next/image';
import { Check } from 'lucide-react';
import { event } from '../../lib/eventData';
import { photos } from './content';
import { Reveal } from './Reveal';

export function KitSection() {
  return <section id="experience" className="kit"><div className="kitVisual"><Image src={photos[1]} fill sizes="(max-width: 800px) 100vw, 50vw" alt="Runner enjoying their run" /><div className="kitTag">9<br /><span>ESSENTIALS</span></div></div><div className="kitContent"><Reveal><p className="eyebrow dark">Collect at the expo</p><h2>WHAT&apos;S IN<br />YOUR <em>RACE KIT?</em></h2><p className="intro">For every 3 KM, 5 KM and 10 KM runner.</p><ol>{event.kit.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}<Check size={16} /></li>)}</ol><p className="muted">Expo & kit distribution: <strong>27 & 28 November 2026</strong></p></Reveal></div></section>;
}
