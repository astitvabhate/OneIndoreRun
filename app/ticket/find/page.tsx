import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { FindTicketForm } from './FindTicketForm';
import '../[id]/ticket.css';

export const metadata: Metadata = { title: 'Find my ticket | One Indore Run Indore', robots: { index: false, follow: false } };

// For runners who lost their ticket link: look it up with the details they registered with.
export default function FindTicketPage() {
  return (
    <main className="ticketPage">
      <header className="regNav">
        <Logo />
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      {/* Same banner and form style as the register page. */}
      <section className="findHero">
        <p className="eyebrow dark">Lost your ticket?</p>
        <h1>FIND YOUR<br /><em>TICKET.</em></h1>
        <p>Enter the mobile number and date of birth you registered with. We&apos;ll show every paid registration that matches.</p>
        <p className="findHeroLink">Not registered yet? <Link href="/register">Register now</Link> · Paid but no ticket? <Link href="/help">Report it</Link></p>
      </section>

      <div className="findBody">
        <FindTicketForm />
      </div>
    </main>
  );
}
