import Link from 'next/link';
import { LogOut, ScanLine } from 'lucide-react';
import { Logo } from '../../components/Logo';
import type { Staff } from '../../lib/server/adminAuth';
import { countOpenIssues } from '../../lib/server/issues';
import { logout } from './actions';
import { StaffNav } from './StaffNav';

/** Top bar for organiser and volunteer pages. On phones, organisers get a bottom tab bar instead of links. */
export async function StaffBar({ staff, title }: { staff: Staff; title: string }) {
  const openIssues = staff.role === 'admin' ? ((await countOpenIssues()) ?? 0) : 0;
  return (
    <header className="adminBar">
      <Logo />
      <span className="adminTitle">{title}</span>
      <StaffNav role={staff.role} openIssues={openIssues} />
      <div className="adminBarActions">
        {staff.role === 'volunteer' && (
          <Link href="/admin/checkin" className="adminIconLink" aria-label="Check-in"><ScanLine size={18} /><span className="adminLinkText">Check-in</span></Link>
        )}
        <span className="adminWho" title={`${staff.name} · ${staff.role}`}>
          <span className="adminAvatar" aria-hidden="true">{staff.name.trim().charAt(0).toUpperCase()}</span>
          <span className="adminWhoText"><b>{staff.name}</b><small>{staff.role === 'admin' ? 'Organiser' : 'Volunteer'}</small></span>
        </span>
        <form action={logout}>
          <button type="submit" className="adminIconLink" aria-label="Sign out"><LogOut size={18} /><span className="adminLinkText">Sign out</span></button>
        </form>
      </div>
    </header>
  );
}
