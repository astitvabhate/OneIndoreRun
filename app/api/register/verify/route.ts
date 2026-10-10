import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findRace } from '../../../../lib/eventData';
import { formatRegNo } from '../../../../lib/registrationSchema';
import { isRegistrationOpen } from '../../../../lib/server/config';
import { markPaid } from '../../../../lib/server/db';
import { isValidPaymentSignature } from '../../../../lib/server/razorpay';

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// Step 2 of checkout: confirm the payment really came from Razorpay before marking it paid.
export async function POST(request: Request) {
  if (!isRegistrationOpen()) {
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
    const payment = await markPaid(orderId, paymentId);
    if (!payment) return NextResponse.json({ error: 'unknown_order' }, { status: 404 });
    return NextResponse.json({
      ticketId: payment.id,
      regNo: formatRegNo(payment.regNo),
      race: findRace(payment.category)?.distance,
      // The runner had already paid through another checkout window; this payment needs a refund.
      duplicatePayment: payment.outcome === 'duplicate',
    });
  } catch (error) {
    console.error('Payment verification failed', error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
