'use server';

import { redirect } from 'next/navigation';
import { adminEditSchema, cancelRunner, collectKit, recordSignIn, restoreRunner, undoKit, updateRunner } from '../../lib/server/admin';
import { endSession, requireAdmin, requireStaff, roleForPassword, staffLabel, startSession } from '../../lib/server/adminAuth';

// Every action checks the caller's role itself: server actions can be called directly, not only from our buttons.

const slowDown = () => new Promise((resolve) => setTimeout(resolve, 800)); // makes password guessing slow

export async function login(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 40);
  const role = roleForPassword(String(formData.get('password') ?? ''));
  if (!role) {
    await slowDown();
    redirect('/admin/login?error=password');
  }
  if (name.length < 2) redirect('/admin/login?error=name');
  await startSession(role, name);
  await recordSignIn(staffLabel({ role, name }));
  redirect(role === 'admin' ? '/admin' : '/admin/checkin');
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
