import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AlertCircle, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Logo } from '../../../components/Logo';
import { getStaff, isAdminConfigured } from '../../../lib/server/adminAuth';
import { login } from '../actions';
import { PasswordField } from './PasswordField';

const errors: Record<string, string> = {
  credentials: 'That username or password is not right.',
  busy: 'Too many sign-in attempts. Please wait 10 minutes and try again.',
  unavailable: 'Sign-in is unavailable right now (the database could not be reached). Please try again shortly.',
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await getStaff();
  if (staff) redirect(staff.role === 'admin' ? '/admin' : '/admin/checkin');
  const { error } = await searchParams;

  return (
    <main className="adminLogin">
      <aside className="adminLoginHero" aria-hidden="true">
        <Image src="/assets/MNS08103.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 55vw" priority />
        <div className="adminLoginHeroText">
          <span>Staff console</span>
          <p>Registrations, kit check-in and race-day operations in one place.</p>
        </div>
      </aside>

      <section className="adminLoginPane">
        <form action={login} className="adminLoginCard">
          <Logo />
          <header>
            <span className="adminLoginEyebrow"><LockKeyhole size={13} /> Restricted access</span>
            <h1>Sign in</h1>
            <p>For organisers and volunteers of One Indore Run.</p>
          </header>
          {isAdminConfigured() ? (
            <>
              {error && errors[error] && (
                <p className="adminError" role="alert"><AlertCircle size={16} /> {errors[error]}</p>
              )}
              <label>
                Username
                <input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. priya.sharma" required maxLength={32} autoFocus />
              </label>
              <label>
                Password
                <PasswordField />
              </label>
              <button className="button adminLoginSubmit" type="submit">Sign in <ArrowRight size={16} /></button>
              <p className="adminLoginNote"><ShieldCheck size={15} /> Use the username and password given to you. Every action is logged under your name.</p>
            </>
          ) : (
            <p className="adminError"><AlertCircle size={16} /> <span>Admin access is switched off. Set <code>STAFF_SESSION_SECRET</code> (at least 32 characters) and the Supabase keys in <code>.env.local</code>, or in Vercel for the live site.</span></p>
          )}
        </form>
      </section>
    </main>
  );
}
