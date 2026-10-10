import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// One shared admin password (ADMIN_PASSWORD). A login sets a signed, http-only cookie that
// expires after 12 hours. Changing the password signs everyone out, because it is the signing key.
const cookieName = 'oir_admin';
const sessionHours = 12;

const password = () => process.env.ADMIN_PASSWORD ?? '';
export const isAdminConfigured = () => password().length >= 12;

const signingKey = () => createHash('sha256').update(`oir-admin:${password()}`).digest();
const sign = (value: string) => createHmac('sha256', signingKey()).update(value).digest('hex');
const equal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Constant-time password check (both sides are hashed to the same length first). */
export const checkPassword = (attempt: string) => isAdminConfigured() && equal(sign(attempt), sign(password()));

export async function startSession() {
  const expires = String(Date.now() + sessionHours * 3_600_000);
  (await cookies()).set(cookieName, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: sessionHours * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: cookieName, path: '/admin' });
}

export async function isAdmin() {
  if (!isAdminConfigured()) return false;
  const [expires, signature] = ((await cookies()).get(cookieName)?.value ?? '').split('.');
  return Boolean(expires && signature) && Number(expires) > Date.now() && equal(signature, sign(expires));
}

/** For admin pages: sends anyone without a valid session to the login page. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}
