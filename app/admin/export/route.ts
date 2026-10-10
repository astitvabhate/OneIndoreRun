import { NextResponse } from 'next/server';
import { allRegistrations, applyFilters, readFilters, toCsv } from '../../../lib/server/admin';
import { getStaff } from '../../../lib/server/adminAuth';

// CSV of the registrations matching the dashboard's current filters. Organisers only.
export async function GET(request: Request) {
  if ((await getStaff())?.role !== 'admin') return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const filters = readFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = applyFilters(await allRegistrations(), filters).sort((a, b) => (a.reg_no ?? Infinity) - (b.reg_no ?? Infinity));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="one-indore-run-${filters.status}-${today}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
