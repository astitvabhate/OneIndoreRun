'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LifeBuoy, Menu, Ticket, X } from 'lucide-react';
import { Logo } from './Logo';

const links = [
  ['About', '#about'],
  ['Races', '#races'],
  ['Race kit', '#race-kit'],
  ['Route', '#route'],
  ['Gallery', '#gallery'],
  ['FAQ', '#faq'],
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The bar turns solid once the page scrolls so Register stays reachable everywhere.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={scrolled || open ? 'nav isSolid' : 'nav'}>
      <Logo />
      <nav aria-label="Main">
        {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
      </nav>
      <div className="navActions">
        <Link className="navTicket" href="/help" aria-label="Help"><LifeBuoy size={15} /> <span>Help</span></Link>
        <Link className="navTicket" href="/ticket/find" aria-label="Find ticket"><Ticket size={15} /> <span>Find ticket</span></Link>
        <Link className="button small" href="/register">Register <ArrowUpRight size={15} /></Link>
      </div>
      <button className="menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <div className="mobileNav">
          {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <Link href="/ticket/find" onClick={() => setOpen(false)}>Find my ticket</Link>
          <Link href="/help" onClick={() => setOpen(false)}>Help &amp; report an issue</Link>
          <Link className="button" href="/register">Register now <ArrowUpRight size={17} /></Link>
        </div>
      )}
    </header>
  );
}
