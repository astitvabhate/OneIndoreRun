import Link from 'next/link';
import { LayoutDashboard, LogOut, ScanLine } from 'lucide-react';
import { Logo } from '../../components/Logo';
import type { Staff } from '../../lib/server/adminAuth';
import { logout } from './actions';

/** Top bar for organiser and volunteer pages. Volunteers only see the check-in link. */
export function StaffBar({ staff, title }: { staff: Staff; title: string }) {
  return (
    <header className="adminBar">
      <Logo />
      <span className="adminTitle">{title}</span>
      <nav className="adminBarActions" aria-label="Staff">
        {staff.role === 'admin' && <Link href="/admin" className="adminIconLink"><LayoutDashboard size={16} /> Dashboard</Link>}
        <Link href="/admin/checkin" className="adminIconLink"><ScanLine size={16} /> Check-in</Link>
        <span className="adminWho">{staff.name} · {staff.role}</span>
        <form action={logout}><button type="submit" className="adminIconLink"><LogOut size={16} /> Sign out</button></form>
      </nav>
    </header>
  );
}
