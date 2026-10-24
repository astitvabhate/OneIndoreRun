import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { FindTicketForm } from './FindTicketForm';
import '../[id]/ticket.css';

export const metadata: Metadata = { title: 'Find my ticket | One Indore Run', robots: { index: false, follow: false } };

// For runners who lost their ticket link: look it up with the details they registered with.
export default function FindTicketPage() {
  return (
    <main className="ticketPage">
      <header className="regNav">
        <Logo />
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <article className="ticket">
        <div className="ticketBody">
          <span className="ticketLabel">Lost your ticket?</span>
          <h1>Find my ticket</h1>
          <p className="ticketNote">Enter the mobile number and date of birth you used when registering. We&apos;ll show every paid registration that matches.</p>
          <FindTicketForm />
        </div>
      </article>
    </main>
  );
}
