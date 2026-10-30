import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AlertCircle, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
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
                Your name
                <input name="name" autoComplete="name" placeholder="e.g. Priya Sharma" required minLength={2} maxLength={40} autoFocus />
              </label>
              <label>
                Password
                <input type="password" name="password" autoComplete="current-password" placeholder="••••••••••••" required />
              </label>
              <button className="button adminLoginSubmit" type="submit">Sign in <ArrowRight size={16} /></button>
              <p className="adminLoginNote"><ShieldCheck size={15} /> Volunteers use the volunteer password and can only check in kits. Every action is logged under your name.</p>
            </>
          ) : (
            <p className="adminError"><AlertCircle size={16} /> <span>Admin access is switched off. Set <code>ADMIN_PASSWORD</code> (at least 12 characters) in <code>.env.local</code>, or in Vercel for the live site.</span></p>
          )}
        </form>
      </section>
    </main>
  );
}
