import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Two shared passwords: ADMIN_PASSWORD (organisers: everything) and VOLUNTEER_PASSWORD (expo
// volunteers: kit check-in only). A login sets a signed, http-only cookie holding the role and the
// person's name for 12 hours. Changing either password signs everyone out, since both form the key.
export type StaffRole = 'admin' | 'volunteer';
export interface Staff {
  role: StaffRole;
  name: string;
}

/** How a staff member appears in the activity log and on kit check-ins, e.g. 'Ravi (volunteer)'. */
export const staffLabel = (staff: Staff) => `${staff.name} (${staff.role})`;

const cookieName = 'oir_staff';
const sessionHours = 12;

const adminPassword = () => process.env.ADMIN_PASSWORD ?? '';
const volunteerPassword = () => process.env.VOLUNTEER_PASSWORD ?? '';
const usable = (password: string) => password.length >= 12;
export const isAdminConfigured = () => usable(adminPassword());

const signingKey = () => createHash('sha256').update(`oir-staff:${adminPassword()}:${volunteerPassword()}`).digest();
const sign = (value: string) => createHmac('sha256', signingKey()).update(value).digest('hex');
const equal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
// Both sides are hashed to the same length first, so the comparison takes constant time.
const matches = (attempt: string, password: string) => usable(password) && equal(sign(attempt), sign(password));

/** Which role a password unlocks, if any. */
export function roleForPassword(attempt: string): StaffRole | null {
  if (matches(attempt, adminPassword())) return 'admin';
  if (matches(attempt, volunteerPassword())) return 'volunteer';
  return null;
}

export async function startSession(role: StaffRole, name: string) {
  const expires = String(Date.now() + sessionHours * 3_600_000);
  const payload = `${role}.${expires}.${Buffer.from(name).toString('base64url')}`;
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

/** The signed-in organiser or volunteer, or null. */
export async function getStaff(): Promise<Staff | null> {
  if (!isAdminConfigured()) return null;
  const parts = ((await cookies()).get(cookieName)?.value ?? '').split('.');
  if (parts.length !== 4) return null;
  const [role, expires, name, signature] = parts;
  const valid = (role === 'admin' || role === 'volunteer') && Number(expires) > Date.now() && equal(signature, sign(`${role}.${expires}.${name}`));
  return valid ? { role, name: Buffer.from(name, 'base64url').toString() } : null;
}

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
