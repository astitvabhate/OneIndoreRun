import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findRace } from '../../../../lib/eventData';
import { formatRegNo } from '../../../../lib/registrationSchema';
import { confirmPayment } from '../../../../lib/server/checkout';
import { isPaymentConfigured } from '../../../../lib/server/config';
import { isValidPaymentSignature } from '../../../../lib/server/razorpay';

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

const refundMessages = {
  cancelled: 'This registration had been cancelled by the organisers, so your payment will be refunded within 5–7 days.',
  sold_out: 'Sorry, this run sold out while you were paying, so your payment will be refunded within 5–7 days.',
};

// Step 2 of checkout: confirm the payment really came from Razorpay, capture it and record it.
// Works after registration closes, so runners who were mid-checkout are still recorded.
export async function POST(request: Request) {
  if (!isPaymentConfigured()) {
    return NextResponse.json({ error: 'not_open' }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  if (!isValidPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  try {
    const result = await confirmPayment(orderId, paymentId);
    if (result.status === 'unknown_order') return NextResponse.json({ error: 'unknown_order' }, { status: 404 });
    if (result.status === 'not_captured') {
      return NextResponse.json(
        { error: 'not_captured', message: 'Your payment did not complete. If money was deducted, your bank will return it automatically.' },
        { status: 402 },
      );
    }

    const { payment } = result;
    if (payment.outcome === 'cancelled' || payment.outcome === 'sold_out') {
      return NextResponse.json({ error: 'refund', message: refundMessages[payment.outcome] }, { status: 409 });
    }
    return NextResponse.json({
      ticketId: payment.id,
      regNo: formatRegNo(payment.regNo),
      race: findRace(payment.category)?.distance,
      // The runner had already paid through another checkout window; this payment will be refunded.
      duplicatePayment: payment.outcome === 'duplicate',
    });
  } catch (error) {
    console.error('Payment verification failed', orderId, paymentId, error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
