import { db } from './db';

// Problems runners report from the Help page (/help). Organisers read them on the dashboard's
// Issues page, fix whatever is wrong (often in Razorpay or on the runner's page), and mark them
// resolved with a note of what they did.

export const issueCategories = {
  payment: 'Payment',
  ticket: 'Ticket or QR code',
  details: 'Wrong details',
  kit: 'Race kit or T-shirt',
  other: 'Something else',
} as const;
export type IssueCategory = keyof typeof issueCategories;
export type IssueStatus = 'open' | 'resolved';

export interface NewIssue {
  category: IssueCategory;
  name: string;
  mobile: string;
  email: string | null;
  regNo: string | null;
  paymentRef: string | null;
  message: string;
}

export interface Issue {
  id: number;
  category: IssueCategory;
  name: string;
  mobile: string;
  email: string | null;
  reg_no: string | null;
  payment_ref: string | null;
  message: string;
  status: IssueStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** Saves a runner's report and returns its reference number. */
export async function createIssue(issue: NewIssue) {
  const { data, error } = await db()
    .from('issues')
    .insert({
      category: issue.category, name: issue.name, mobile: issue.mobile, email: issue.email,
      reg_no: issue.regNo, payment_ref: issue.paymentRef, message: issue.message,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as number;
}

/** A page of issues, newest first (open ones oldest first, so the longest-waiting is on top). */
export async function listIssues(status: IssueStatus | 'all', search: string, page: number, perPage: number) {
  let query = db().from('issues').select('*', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  const text = search.trim().replace(/[*%\\"]/g, '');
  if (text) {
    const like = (column: string) => `${column}.ilike."%${text}%"`;
    const id = /^#?\d{1,12}$/.test(text) ? `id.eq.${text.replace('#', '')},` : '';
    query = query.or(id + ['name', 'mobile', 'reg_no', 'payment_ref', 'email'].map(like).join(','));
  }
  const { data, error, count } = await query
    .order('created_at', { ascending: status === 'open' })
    .range((page - 1) * perPage, page * perPage - 1);
  if (error) throw error;
  return { issues: data as Issue[], total: count ?? 0 };
}

/** How many issues are waiting; null if it can't be read (e.g. the table isn't set up yet). */
export async function countOpenIssues() {
  const { count, error } = await db().from('issues').select('id', { count: 'exact', head: true }).eq('status', 'open');
  if (error) {
    console.error('Could not count open issues', error);
    return null;
  }
  return count ?? 0;
}

export async function resolveIssue(id: number, resolution: string, by: string) {
  const { error } = await db()
    .from('issues')
    .update({ status: 'resolved', resolution: resolution || null, resolved_by: by, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function reopenIssue(id: number) {
  const { error } = await db().from('issues').update({ status: 'open', resolved_by: null, resolved_at: null }).eq('id', id);
  if (error) throw error;
}
