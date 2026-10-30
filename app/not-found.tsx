import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Ticket } from 'lucide-react';
import { Logo } from '../components/Logo';
import './not-found.css';

export const metadata: Metadata = { title: 'Page not found | One Indore Run Indore', robots: { index: false, follow: false } };

// Shown for any unknown address, and wherever a page calls notFound() (e.g. a ticket link that doesn't exist).
export default function NotFound() {
  return (
    <main className="notFound">
      <header className="notFoundNav">
        <Logo />
        <Link href="/" className="notFoundBack"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <section className="notFoundBody">
        <p className="eyebrow"><i /> Error 404</p>
        <span className="notFoundCode" aria-hidden>404</span>
        <h1>WRONG <em>TURN.</em></h1>
        <p className="notFoundText">
          This page isn&apos;t on the route. The link may be mistyped or out of date. If you were looking for your race ticket,
          you can find it with your mobile number and date of birth.
        </p>
        <div className="notFoundActions">
          <Link href="/" className="button">Back to home <ArrowUpRight size={16} /></Link>
          <Link href="/ticket/find" className="button ghost"><Ticket size={16} /> Find my ticket</Link>
          <Link href="/register" className="button ghost">Register</Link>
        </div>
      </section>
    </main>
  );
}
