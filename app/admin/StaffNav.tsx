'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, History, LayoutDashboard, LifeBuoy, ScanLine } from 'lucide-react';
import type { StaffRole } from '../../lib/server/adminAuth';

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { href: '/admin/registrations', label: 'Runners', icon: ClipboardList, adminOnly: true },
  { href: '/admin/checkin', label: 'Check-in', icon: ScanLine, adminOnly: false },
  { href: '/admin/activity', label: 'Activity', icon: History, adminOnly: true },
  { href: '/admin/groups', label: 'Groups', icon: Building2, adminOnly: true },
  { href: '/admin/issues', label: 'Issues', icon: LifeBuoy, adminOnly: true },
];

/** Staff page links, highlighting the current one. In the top bar on desktop, a bottom tab bar on phones. */
export function StaffNav({ role, openIssues }: { role: StaffRole; openIssues: number }) {
  const path = usePathname();
  // A runner's page belongs to Runners; importing belongs to Groups.
  const current = (href: string) =>
    href === '/admin' ? path === '/admin'
    : href === '/admin/registrations' ? path.startsWith(href) || path.startsWith('/admin/runner')
    : href === '/admin/groups' ? path.startsWith(href) || path.startsWith('/admin/import')
    : path.startsWith(href);
  const shown = links.filter((link) => role === 'admin' || !link.adminOnly);
  if (shown.length < 2) return null;
  return (
    <nav className="adminNav" aria-label="Staff">
      {shown.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={current(href) ? 'active' : undefined} aria-current={current(href) ? 'page' : undefined}>
          <span className="adminNavIcon">
            <Icon size={18} />
            {href === '/admin/issues' && openIssues > 0 && <b className="adminNavBadge" aria-label={`${openIssues} open`}>{openIssues > 99 ? '99+' : openIssues}</b>}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
