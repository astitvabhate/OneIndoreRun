'use client';

import { CircleAlert } from 'lucide-react';
import { logout } from './actions';

// Shown when an admin page can't load its data (e.g. the database is down or not set up yet).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="adminLogin">
      <div className="adminLoginCard">
        <h1><CircleAlert size={22} /> Couldn&apos;t load this page</h1>
        <p className="adminError" role="alert">
          The registration data could not be read. The database may be offline or not set up yet.
        </p>
        <p className="adminHint">
          Organisers: run <code>npm run check:setup</code> to see what&apos;s wrong
          {error.digest && <> (error reference <code>{error.digest}</code>)</>}.
        </p>
        <button type="button" className="button" onClick={reset}>Try again</button>
        <form action={logout}><button type="submit" className="button outline">Sign out</button></form>
      </div>
    </main>
  );
}
