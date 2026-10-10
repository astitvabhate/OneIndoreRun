'use server';

import { redirect } from 'next/navigation';
import { adminEditSchema, cancelRunner, collectKit, restoreRunner, undoKit, updateRunner } from '../../lib/server/admin';
import { endSession, requireAdmin, requireStaff, roleForPassword, startSession } from '../../lib/server/adminAuth';

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
  const { outcome } = await collectKit(id, staff.name);
  redirect(`/ticket/${id}?kit=${outcome}`);
}

export async function undoKitCheckIn(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await undoKit(id, staff.name);
  redirect(`/admin/runner/${id}?saved=kit`);
}

export type EditState = { errors?: Record<string, string[] | undefined>; message?: string } | undefined;

export async function saveRunner(_previous: EditState, formData: FormData): Promise<EditState> {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  const parsed = adminEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: 'Please fix the highlighted fields.' };
  const problem = await updateRunner(id, parsed.data, staff.name);
  if (problem) return { message: problem };
  redirect(`/admin/runner/${id}?saved=details`);
}

export async function cancelRegistration(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await cancelRunner(id, String(formData.get('reason') ?? '').trim().slice(0, 300), staff.name);
  redirect(`/admin/runner/${id}?saved=cancelled`);
}

export async function restoreRegistration(formData: FormData) {
  const staff = await requireAdmin();
  const id = idFrom(formData);
  await restoreRunner(id, staff.name);
  redirect(`/admin/runner/${id}?saved=restored`);
}
