import { NextResponse } from 'next/server';
import { csvHeader, csvRows, readFilters, registrationsForExport } from '../../../lib/server/admin';
import { getStaff } from '../../../lib/server/adminAuth';

// CSV of the registrations matching the dashboard's current filters. Organisers only.
// Streamed a batch at a time, so a six-figure export never sits in memory all at once.
export async function GET(request: Request) {
  if ((await getStaff())?.role !== 'admin') return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const filters = readFilters(Object.fromEntries(new URL(request.url).searchParams));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const batches = registrationsForExport(filters);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(csvHeader()));
    },
    async pull(controller) {
      try {
        const { value, done } = await batches.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(csvRows(value)));
      } catch (error) {
        console.error('CSV export failed', error);
        controller.error(error);
      }
    },
    cancel() {
      void batches.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="one-indore-run-${filters.status}-${today}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
