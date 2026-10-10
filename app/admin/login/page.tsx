import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { isAdmin, isAdminConfigured } from '../../../lib/server/adminAuth';
import { login } from '../actions';

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect('/admin');
  const { error } = await searchParams;

  return (
    <main className="adminLogin">
      <form action={login} className="adminLoginCard">
        <Logo />
        <h1><LockKeyhole size={22} /> Organiser login</h1>
        {isAdminConfigured() ? (
          <>
            <label>
              Admin password
              <input type="password" name="password" autoComplete="current-password" required autoFocus />
            </label>
            {error && <p className="adminError" role="alert">That password is not right.</p>}
            <button className="button" type="submit">Sign in</button>
          </>
        ) : (
          <p className="adminError">Admin access is switched off. Set <code>ADMIN_PASSWORD</code> (at least 12 characters) in <code>.env.local</code>, or in Vercel for the live site.</p>
        )}
      </form>
    </main>
  );
}
