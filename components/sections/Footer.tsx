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
      </div>
      <div className="footerBottom">
        <span>© 2026 One Indore Run Indore. All rights reserved.</span>
        {/* <span>Terms &amp; Conditions · Privacy Policy · Refund Policy</span> */}
      </div>
    </footer>
  );
}
