import Image from 'next/image';
import { photos } from './content';

export function IndoreSection() {
  return <section className="indore"><Image src={photos[5]} fill sizes="100vw" alt="People moving through a lively city" /><div><p className="eyebrow">Made in Indore</p><h2>RUN THE HEART<br />OF <em>INDORE.</em></h2><p>From its unmistakable streets to its generous spirit, Indore is a city that shows up. This is our invitation to move through it together.</p></div></section>;
}
