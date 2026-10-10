import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { getStaff, isAdminConfigured } from '../../../lib/server/adminAuth';
import { login } from '../actions';

const errors: Record<string, string> = {
  password: 'That password is not right.',
  name: 'Please enter your name (it is recorded against check-ins and edits).',
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await getStaff();
  if (staff) redirect(staff.role === 'admin' ? '/admin' : '/admin/checkin');
  const { error } = await searchParams;

  return (
    <main className="adminLogin">
      <form action={login} className="adminLoginCard">
        <Logo />
        <h1><LockKeyhole size={22} /> Organiser &amp; volunteer login</h1>
        {isAdminConfigured() ? (
          <>
            <label>
              Your name
              <input name="name" autoComplete="name" required minLength={2} maxLength={40} autoFocus />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            {error && errors[error] && <p className="adminError" role="alert">{errors[error]}</p>}
            <button className="button" type="submit">Sign in</button>
            <p className="adminHint">Volunteers use the volunteer password and can only check in kits.</p>
          </>
        ) : (
          <p className="adminError">Admin access is switched off. Set <code>ADMIN_PASSWORD</code> (at least 12 characters) in <code>.env.local</code>, or in Vercel for the live site.</p>
        )}
      </form>
    </main>
  );
}
