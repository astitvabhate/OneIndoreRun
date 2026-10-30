import { Logo } from '../Logo';
import { event } from '../../lib/eventData';

const quickLinks = [
  ['Races', '/#races'],
  ['Race kit', '/#race-kit'],
  ['Route', '/#route'],
  ['FAQ', '/#faq'],
];

export function Footer() {
  return (
    <footer>
      <div className="footerTop">
        <div className="footerBrand">
          <Logo />
          <p>
            Indore, Madhya Pradesh<br />
            <a href={`tel:+91${event.contact.phone}`}>+91 {event.contact.phone}</a><br />
            <a href={`mailto:${event.contact.email}`}>{event.contact.email}</a>
          </p>
        </div>
        <nav aria-label="Footer" className="footerLinks">
          {quickLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
      </div>
      <div className="footerBottom">
        <span>© 2026 One Indore Run Indore. All rights reserved.</span>
        {/* <span>Terms &amp; Conditions · Privacy Policy · Refund Policy</span> */}
      </div>
    </footer>
  );
}
