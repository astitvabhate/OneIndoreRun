'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminEditSchema, cancelRunner, collectKit, recordSignIn, restoreRunner, undoKit, updateRunner } from '../../lib/server/admin';
import { maxImportBytes, runImport, type ImportReport } from '../../lib/server/csvImport';
import { checkCredentials, endSession, normaliseUsername, requireAdmin, requireStaff, staffLabel, startSession } from '../../lib/server/adminAuth';
import { clientIp, withinLimits } from '../../lib/server/rateLimit';

// Every action checks the caller's role itself: server actions can be called directly, not only from our buttons.

const slowDown = () => new Promise((resolve) => setTimeout(resolve, 800)); // makes password guessing slow

export async function login(formData: FormData) {
  const username = normaliseUsername(String(formData.get('username') ?? '')).slice(0, 64);
  const allowed = await withinLimits([
    { key: `login:ip:${clientIp(await headers())}`, max: 30, windowSeconds: 600 },
    { key: `login:user:${username}`, max: 10, windowSeconds: 600 },
  ]);
  if (!allowed) redirect('/admin/login?error=busy');
  const staff = await checkCredentials(username, String(formData.get('password') ?? '').slice(0, 200));
  if (!staff) {
    await slowDown();
    redirect('/admin/login?error=credentials');
  }
  await startSession(staff);
  await recordSignIn(staffLabel(staff));
  redirect(staff.role === 'admin' ? '/admin' : '/admin/checkin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}

const idFrom = (formData: FormData) => String(formData.get('id') ?? '');

export async function markKitCollected(formData: FormData) {
  const staff = await requireStaff();
  const id = idFrom(formData);
  const outcome = await collectKit(id, staffLabel(staff));
  // Organisers can also check a kit in from the runner page; send them back there.
  if (formData.get('from') === 'runner' && staff.role === 'admin') redirect(`/admin/runner/${id}?saved=kit_${outcome}`);
  redirect(`/admin/checkin/${id}?kit=${outcome}`);
}

export async function undoKitCheckIn(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await undoKit(id, staffLabel(staff));
  redirect(`/admin/runner/${id}?saved=kit`);
}

export type EditState = { errors?: Record<string, string[] | undefined>; message?: string } | undefined;

export async function saveRunner(_previous: EditState, formData: FormData): Promise<EditState> {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  const parsed = adminEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: 'Please fix the highlighted fields.' };
  const problem = await updateRunner(id, parsed.data, staffLabel(staff));
  if (problem) return { message: problem };
  redirect(`/admin/runner/${id}?saved=details`);
}

export async function cancelRegistration(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await cancelRunner(id, String(formData.get('reason') ?? '').trim().slice(0, 300), staffLabel(staff));
  redirect(`/admin/runner/${id}?saved=cancelled`);
}

export async function restoreRegistration(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await restoreRunner(id, staffLabel(staff));
  redirect(`/admin/runner/${id}?saved=restored`);
}

export type ImportState = { report?: ImportReport; message?: string } | undefined;

/** Checks an uploaded CSV of runners, or imports it as paid (offline) registrations. */
export async function importRunners(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const staff = await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { message: 'Choose a CSV file first.' };
  if (file.size > maxImportBytes) return { message: 'The file is larger than 2 MB. Please split it into smaller files.' };
  if (!/\.(csv|txt)$/i.test(file.name)) return { message: 'Please upload a .csv file. In Excel or Google Sheets: File → Save as / Download → CSV.' };

  const text = (field: string) => String(formData.get(field) ?? '').trim().slice(0, 300);
  const feeInr = Number(formData.get('feeInr'));
  if (!(feeInr >= 1 && feeInr <= 100_000)) return { message: 'Enter the fee collected per runner (at least ₹1).' };
  if (formData.get('consent') !== 'on') return { message: 'Please confirm that consent has been collected for these runners.' };

  const mode = formData.get('mode') === 'import' ? 'import' : 'check';
  const result = await runImport(await file.text(), file.name, {
    race: text('race'), tshirtSize: text('tshirtSize'), city: text('city'), address: text('address'), pincode: text('pincode'),
    email: text('email'), contactName: text('contactName'), contactMobile: text('contactMobile'), note: text('note'), feeInr,
  }, mode, staffLabel(staff));
  return typeof result === 'string' ? { message: result } : { report: result };
}
