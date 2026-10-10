import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { photos } from './content';

export function FinalCallToAction() {
  return <section className="final"><Image src={photos[3]} fill sizes="100vw" alt="Runner in motion" /><div><p className="eyebrow">The starting line is yours</p><h2>READY TO<br /><em>RUN INDORE?</em></h2><p>YOUR CITY. YOUR PACE. YOUR RUN.</p><Link href="/register" className="button">Register now <ArrowUpRight /></Link></div></section>;
}
