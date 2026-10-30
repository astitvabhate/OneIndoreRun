'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, ClipboardList, History, LayoutDashboard, LifeBuoy, ScanLine } from 'lucide-react';
import type { StaffRole } from '../../lib/server/adminAuth';

// Where each link sits on phones: the bottom tab bar, an icon in the top bar next to the profile, or
// nowhere (Issues is reached from the dashboard).
const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true, phone: 'tabs' },
  { href: '/admin/registrations', label: 'Runners', icon: ClipboardList, adminOnly: true, phone: 'tabs' },
  { href: '/admin/checkin', label: 'Check-in', icon: ScanLine, adminOnly: false, phone: 'tabs' },
  { href: '/admin/activity', label: 'Activity', icon: History, adminOnly: true, phone: 'top' },
  { href: '/admin/groups', label: 'Groups', icon: Building2, adminOnly: true, phone: 'tabs' },
  { href: '/admin/issues', label: 'Issues', icon: LifeBuoy, adminOnly: true, phone: 'hidden' },
];

type NavLink = (typeof links)[number];

// A runner's page belongs to Runners; importing belongs to Groups.
function isCurrent(path: string, href: string) {
  return href === '/admin' ? path === '/admin'
    : href === '/admin/registrations' ? path.startsWith(href) || path.startsWith('/admin/runner')
    : href === '/admin/groups' ? path.startsWith(href) || path.startsWith('/admin/import')
    : path.startsWith(href);
}

function LinkIcon({ link: { href, icon: Icon }, openIssues }: { link: NavLink; openIssues: number }) {
  return (
    <span className="adminNavIcon">
      <Icon size={18} />
      {href === '/admin/issues' && openIssues > 0 && <b className="adminNavBadge" aria-label={`${openIssues} open`}>{openIssues > 99 ? '99+' : openIssues}</b>}
    </span>
  );
}

/** Staff page links, highlighting the current one. In the top bar on desktop, a bottom tab bar on phones. */
export function StaffNav({ role, openIssues }: { role: StaffRole; openIssues: number }) {
  const path = usePathname();
  const shown = links.filter((link) => role === 'admin' || !link.adminOnly);
  if (shown.length < 2) return null;
  return (
    <nav className="adminNav" aria-label="Staff">
      {shown.map((link) => {
        const current = isCurrent(path, link.href);
        return (
          <Link key={link.href} href={link.href} className={[current && 'active', link.phone !== 'tabs' && 'secondary'].filter(Boolean).join(' ') || undefined} aria-current={current ? 'page' : undefined}>
            <LinkIcon link={link} openIssues={openIssues} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones only: the top-bar links as icons. */
export function StaffShortcuts({ role, openIssues }: { role: StaffRole; openIssues: number }) {
  const path = usePathname();
  if (role !== 'admin') return null;
  return links.filter((link) => link.phone === 'top').map((link) => (
    <Link key={link.href} href={link.href} className={isCurrent(path, link.href) ? 'adminIconLink adminShortcut active' : 'adminIconLink adminShortcut'} aria-label={link.label}>
      <LinkIcon link={link} openIssues={openIssues} />
    </Link>
  ));
}

// Where Back goes when there is no earlier staff page in this tab to return to.
function parentOf(path: string, role: StaffRole) {
  if (path.startsWith('/admin/runner/')) return '/admin/registrations';
  if (path.startsWith('/admin/checkin/')) return '/admin/checkin';
  if (path.startsWith('/admin/groups/') || path.startsWith('/admin/import')) return '/admin/groups';
  if (path === '/admin' || (role === 'volunteer' && path === '/admin/checkin')) return null;
  return role === 'admin' ? '/admin' : null;
}

// The staff pages visited in this tab, so Back can step through them like an app's screen stack.
const stackKey = 'staffStack';
function readStack(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(stackKey) ?? '[]');
  } catch {
    return [];
  }
}
function writeStack(stack: string[]) {
  try {
    sessionStorage.setItem(stackKey, JSON.stringify(stack.slice(-50)));
  } catch {}
}

/** Phones only: a Back button under the logo. Returns to the previous staff page, or else up to the parent page. */
export function StaffBack({ role }: { role: StaffRole }) {
  const path = usePathname();
  const router = useRouter();
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    const stack = readStack();
    if (stack.at(-1) === path) {
      // A reload: nothing to record.
    } else if (stack.at(-2) === path) {
      stack.pop(); // came back
    } else {
      stack.push(path);
    }
    writeStack(stack);
    setHasHistory(stack.length > 1);
  }, [path]);

  const parent = parentOf(path, role);
  if (!hasHistory && !parent) return null;
  return (
    <div className="staffBack">
      <button type="button" onClick={() => (hasHistory ? router.back() : router.push(parent!))}>
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  );
}
