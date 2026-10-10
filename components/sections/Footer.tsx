import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '../Logo';

export function Footer() {
  return <footer><div className="footerTop"><Logo /><p>Indore, Madhya Pradesh<br />Email & phone: To be announced</p><Link href="/register" className="button">Register now <ArrowUpRight /></Link></div><div className="footerBottom"><span>© 2026 One Indore Run. All rights reserved.</span><span>Terms & Conditions · Privacy Policy · Refund Policy</span></div></footer>;
}
