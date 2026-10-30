import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { serverConfig } from './config';

// One login per person, stored in the staff_users table (added with `npm run staff:add`).
// Role 'admin' (organisers: everything) or 'volunteer' (expo volunteers: kit check-in only).
// A login sets a signed, http-only cookie holding the username for 12 hours; every request
// re-reads the account, so switching it off (active = false) or changing its role applies at once.
// Changing STAFF_SESSION_SECRET signs everyone out.
export type StaffRole = 'admin' | 'volunteer';
export interface Staff {
  username: string;
  role: StaffRole;
  name: string;
}

/** How a staff member appears in the activity log and on kit check-ins, e.g. 'Ravi (volunteer)'. */
export const staffLabel = (staff: Staff) => `${staff.name} (${staff.role})`;

const cookieName = 'oir_staff';
const sessionHours = 12;

const sessionSecret = () => process.env.STAFF_SESSION_SECRET ?? '';
export const isAdminConfigured = () => sessionSecret().length >= 32 && Boolean(serverConfig.supabaseUrl && serverConfig.supabaseServiceKey);

const sign = (value: string) => createHmac('sha256', sessionSecret()).update(value).digest('hex');
const equal = (a: Buffer | string, b: Buffer | string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Password hashes: 'scrypt$<salt>$<hash>', both base64url. scripts/add-staff.mjs writes the same format.
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const keyLength = 64;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, keyLength);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function passwordMatches(attempt: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  return equal(await scryptAsync(attempt, Buffer.from(salt, 'base64url'), expected.length), expected);
}

// Checked against when the username does not exist, so a wrong username takes as long as a wrong password.
const decoyHash = hashPassword(randomBytes(16).toString('hex'));

export const normaliseUsername = (username: string) => username.trim().toLowerCase();

/** The active account these credentials unlock, null if none, or 'unavailable' if the accounts can't be read. */
export async function checkCredentials(username: string, password: string): Promise<Staff | null | 'unavailable'> {
  const { data, error } = await db()
    .from('staff_users')
    .select('username, name, role, password_hash')
    .eq('username', normaliseUsername(username))
    .eq('active', true)
    .maybeSingle();
  if (error) {
    console.error('Could not look up staff account', error);
    return 'unavailable';
  }
  const ok = await passwordMatches(password, data?.password_hash ?? (await decoyHash));
  if (!data || !ok) return null;
  await db().from('staff_users').update({ last_sign_in_at: new Date().toISOString() }).eq('username', data.username);
  return { username: data.username, name: data.name, role: data.role };
}

export async function startSession(staff: Staff) {
  const expires = String(Date.now() + sessionHours * 3_600_000);
  const payload = `${Buffer.from(staff.username).toString('base64url')}.${expires}`;
  (await cookies()).set(cookieName, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/', // the ticket pages need it too, for check-in
    maxAge: sessionHours * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: cookieName, path: '/' });
}

/** The signed-in organiser or volunteer, or null. Looked up once per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!isAdminConfigured()) return null;
  const parts = ((await cookies()).get(cookieName)?.value ?? '').split('.');
  if (parts.length !== 3) return null;
  const [username, expires, signature] = parts;
  if (!(Number(expires) > Date.now()) || !equal(signature, sign(`${username}.${expires}`))) return null;
  const { data, error } = await db()
    .from('staff_users')
    .select('username, name, role')
    .eq('username', Buffer.from(username, 'base64url').toString())
    .eq('active', true)
    .maybeSingle();
  if (error) console.error('Could not load staff account', error);
  return data ? { username: data.username, name: data.name, role: data.role } : null;
});

/** For pages any staff member may use (check-in). */
export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  return staff;
}

/** For organiser-only pages; volunteers are sent to the check-in page instead. */
export async function requireAdmin() {
  const staff = await requireStaff();
  if (staff.role !== 'admin') redirect('/admin/checkin');
  return staff;
}
