import { NextResponse } from 'next/server';
import { confirmPayment } from '../../../../lib/server/checkout';
import { markFailed, markRefunded } from '../../../../lib/server/db';
import { fetchPayment, isValidWebhookSignature } from '../../../../lib/server/razorpay';

interface WebhookEvent {
  event: string;
  payload?: {
    payment?: { entity: { id: string; order_id: string | null } };
    refund?: { entity: { payment_id: string } };
  };
}

// Razorpay calls this directly, so payments are recorded even if the runner closes the tab before
// the browser confirms. Configure in Razorpay Dashboard → Webhooks with the events
// payment.authorized, payment.captured, payment.failed and refund.processed.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get('x-razorpay-signature') ?? '')) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  let parsed: WebhookEvent;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const { event, payload } = parsed;
  const payment = payload?.payment?.entity;

  try {
    if ((event === 'payment.authorized' || event === 'payment.captured') && payment?.order_id) {
      await confirmPayment(payment.order_id, payment.id);
    } else if (event === 'payment.failed' && payment?.order_id) {
      await markFailed(payment.order_id);
    } else if (event === 'refund.processed' && payload?.refund) {
      // Only a full refund gives the place up; partial refunds are left to the organisers.
      const refunded = await fetchPayment(payload.refund.entity.payment_id);
      if (refunded.amount_refunded >= refunded.amount) await markRefunded(refunded.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A non-2xx response makes Razorpay retry later.
    console.error('Webhook handling failed', event, error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
