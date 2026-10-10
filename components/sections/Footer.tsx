import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '../Logo';

const quickLinks = [
  ['Races', '/#races'],
  ['Race kit', '/#experience'],
  ['Route', '/#route'],
  ['FAQ', '/#faq'],
];

export function Footer() {
  return (
    <footer>
      <div className="footerTop">
        <div className="footerBrand">
          <Logo />
          <p>Indore, Madhya Pradesh<br />Email &amp; phone: To be announced</p>
        </div>
        <nav aria-label="Footer" className="footerLinks">
          {quickLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <Link href="/register" className="button">Register now <ArrowUpRight size={17} /></Link>
      </div>
      <div className="footerBottom">
        <span>© 2026 One Indore Run. All rights reserved.</span>
        <span>Terms &amp; Conditions · Privacy Policy · Refund Policy</span>
      </div>
    </footer>
  );
}
