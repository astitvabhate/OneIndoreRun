import { isOurOrder, markPaid, markRefunded } from './db';
import { ensureCaptured } from './razorpay';

export type RecordedPayment = NonNullable<Awaited<ReturnType<typeof markPaid>>>;

export type Confirmation =
  | { status: 'recorded'; payment: RecordedPayment }
  | { status: 'not_captured' } // failed, or authorised but could not be captured
  | { status: 'unknown_order' };

/**
 * Turns a successful checkout into a recorded payment: captures the money if Razorpay only
 * authorised it, then records it against the registration. Used by both the browser confirmation
 * and the webhook, so whichever arrives first wins and the other changes nothing.
 */
export async function confirmPayment(orderId: string, paymentId: string): Promise<Confirmation> {
  if (!(await isOurOrder(orderId))) return { status: 'unknown_order' }; // never capture someone else's payment
  const payment = await ensureCaptured(paymentId, orderId);
  if (payment.status !== 'captured' && payment.status !== 'refunded') return { status: 'not_captured' };

  const recorded = await markPaid(orderId, paymentId);
  if (!recorded) return { status: 'unknown_order' };
  // Refunded in Razorpay before we heard about it: record the refund too.
  if (payment.status === 'refunded') await markRefunded(paymentId);
  return { status: 'recorded', payment: recorded };
}
