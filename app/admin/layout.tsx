import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: 'Admin | One Indore Run Indore', robots: { index: false, follow: false } };

// Admin pages read cookies and live data, so they are never cached or prerendered.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
