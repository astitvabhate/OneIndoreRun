import Link from 'next/link';
import { FileUp, History, LayoutDashboard, LogOut, ScanLine } from 'lucide-react';
import { Logo } from '../../components/Logo';
import type { Staff } from '../../lib/server/adminAuth';
import { logout } from './actions';

/** Top bar for organiser and volunteer pages. Volunteers only see the check-in link. On phones the links shrink to icons. */
export function StaffBar({ staff, title }: { staff: Staff; title: string }) {
  return (
    <header className="adminBar">
      <Logo />
      <span className="adminTitle">{title}</span>
      <nav className="adminBarActions" aria-label="Staff">
        {staff.role === 'admin' && (
          <>
            <Link href="/admin" className="adminIconLink" aria-label="Dashboard"><LayoutDashboard size={18} /><span className="adminLinkText">Dashboard</span></Link>
            <Link href="/admin/activity" className="adminIconLink" aria-label="Activity log"><History size={18} /><span className="adminLinkText">Activity</span></Link>
            <Link href="/admin/import" className="adminIconLink" aria-label="Import CSV"><FileUp size={18} /><span className="adminLinkText">Import</span></Link>
          </>
        )}
        <Link href="/admin/checkin" className="adminIconLink" aria-label="Check-in"><ScanLine size={18} /><span className="adminLinkText">Check-in</span></Link>
        <span className="adminWho">{staff.name} · {staff.role}</span>
        <form action={logout}>
          <button type="submit" className="adminIconLink" aria-label="Sign out"><LogOut size={18} /><span className="adminLinkText">Sign out</span></button>
        </form>
      </nav>
    </header>
  );
}
