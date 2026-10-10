import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function RaceDayBar() {
  return <section className="racebar" aria-label="Race day information"><span>RACE DAY</span><strong>COMING SOON</strong><div /><span>3 KM · 5 KM · 10 KM</span><Link href="/register">ENTRY ₹200 <ArrowUpRight size={15} /></Link></section>;
}
