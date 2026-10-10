'use server';

import { redirect } from 'next/navigation';
import { checkPassword, endSession, startSession } from '../../lib/server/adminAuth';

export async function login(formData: FormData) {
  if (!checkPassword(String(formData.get('password') ?? ''))) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // slows down password guessing
    redirect('/admin/login?error=1');
  }
  await startSession();
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}
