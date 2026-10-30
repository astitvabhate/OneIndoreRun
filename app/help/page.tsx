import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { event } from '../../lib/eventData';
import { issueCategories } from '../../lib/server/issues';
import { HelpForm } from './HelpForm';
import '../ticket/[id]/ticket.css';
import './help.css';

export const metadata: Metadata = { title: 'Help | One Indore Run Indore', description: 'Report a problem with your payment, ticket or registration.' };

// For runners with a problem (payment taken but no ticket, wrong details, kit…): it reaches the
// organisers on the dashboard's Issues page.
export default function HelpPage() {
  return (
    <main className="ticketPage">
      <header className="regNav">
        <Logo />
        <Link href="/" className="back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <section className="findHero">
        <p className="eyebrow dark">Need help?</p>
        <h1>REPORT AN<br /><em>ISSUE.</em></h1>
        <p>Problem with a payment, your ticket or your details? Tell us here and an organiser will get back to you.</p>
        <p className="findHeroLink">Lost your ticket? <Link href="/ticket/find">Find it here</Link> first.</p>
      </section>

      <div className="findBody">
        <HelpForm categories={Object.entries(issueCategories)} />
        <p className="helpContact">
          Urgent? Call <a href={`tel:+91${event.contact.phone}`}>+91 {event.contact.phone}</a> or email <a href={`mailto:${event.contact.email}`}>{event.contact.email}</a>.
        </p>
      </div>
    </main>
  );
}
