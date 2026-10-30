'use server';

import { headers } from 'next/headers';
import { serverConfig } from '../../lib/server/config';
import { createIssue, issueCategories, type IssueCategory } from '../../lib/server/issues';
import { clientIp, withinLimits } from '../../lib/server/rateLimit';

export type HelpState = { sent?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> } | undefined;

const text = (formData: FormData, field: string, max: number) => String(formData.get(field) ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

/** Saves a runner's problem for the organisers to look at on the dashboard's Issues page. */
export async function reportIssue(_previous: HelpState, formData: FormData): Promise<HelpState> {
  // Bots fill every field, including this one, which people never see.
  if (text(formData, 'website', 200)) return { sent: true };

  const category = String(formData.get('category') ?? '') as IssueCategory;
  const name = text(formData, 'name', 80);
  const mobile = text(formData, 'mobile', 20).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  const email = text(formData, 'email', 120);
  const regNo = text(formData, 'regNo', 20).toUpperCase();
  const paymentRef = text(formData, 'paymentRef', 60);
  const message = String(formData.get('message') ?? '').trim().slice(0, 2000);

  // Sent back with any error so the form refills (React clears it after each submit).
  const values = { category, name, mobile, email, regNo, paymentRef, message };
  const errors: Record<string, string> = {};
  if (!(category in issueCategories)) errors.category = 'Choose what the problem is about.';
  if (name.length < 2) errors.name = 'Enter your name.';
  if (!/^[6-9]\d{9}$/.test(mobile)) errors.mobile = 'Enter a 10-digit mobile number so we can reach you.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Check the email address, or leave it empty.';
  if (message.length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  if (Object.keys(errors).length) return { errors, values, message: 'Please fix the highlighted fields.' };
  if (!serverConfig.supabaseUrl || !serverConfig.supabaseServiceKey) return { values, message: 'Reporting is not available yet. Please call or email us instead.' };

  const allowed = await withinLimits([
    { key: `help:ip:${clientIp(await headers())}`, max: 10, windowSeconds: 3600 },
    { key: `help:mobile:${mobile}`, max: 5, windowSeconds: 86_400 },
  ]);
  if (!allowed) return { values, message: 'You have sent several reports already. We will get back to you; please wait before sending another.' };

  try {
    await createIssue({ category, name, mobile, email: email || null, regNo: regNo || null, paymentRef: paymentRef || null, message });
    return { sent: true };
  } catch (error) {
    console.error('Could not save issue', error);
    return { values, message: 'We could not send this right now. Please try again in a minute, or call or email us.' };
  }
}
