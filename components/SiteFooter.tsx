'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './sections/Footer';

/** The public site footer on every page except the staff-only admin. */
export function SiteFooter() {
  return usePathname().startsWith('/admin') ? null : <Footer />;
}
