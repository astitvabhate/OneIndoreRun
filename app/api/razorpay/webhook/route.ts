import { NextResponse } from 'next/server';
import { markFailed, markPaid } from '../../../../lib/server/db';
import { isValidWebhookSignature } from '../../../../lib/server/razorpay';

interface PaymentEvent {
  event: string;
  payload: { payment?: { entity: { id: string; order_id: string } } };
}

// Razorpay calls this directly, so a payment is recorded even if the runner closes the tab
// before the browser confirms it. Configure in Razorpay Dashboard → Webhooks with events
// payment.captured and payment.failed.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get('x-razorpay-signature') ?? '')) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  const { event, payload } = JSON.parse(rawBody) as PaymentEvent;
  const payment = payload.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ok: true });

  try {
    if (event === 'payment.captured') await markPaid(payment.order_id, payment.id);
    if (event === 'payment.failed') await markFailed(payment.order_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A non-2xx response makes Razorpay retry later.
    console.error('Webhook handling failed', event, error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
