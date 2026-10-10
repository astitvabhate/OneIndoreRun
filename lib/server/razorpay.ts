import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverConfig } from './config';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Creates an order through Razorpay's REST API. Amount is in paise. */
export async function createOrder(amount: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${serverConfig.razorpayKeyId}:${serverConfig.razorpayKeySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
  });
  if (!response.ok) throw new Error(`Razorpay order failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function safeEqual(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks the signature Razorpay Checkout returns after a successful payment. */
export function isValidPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac('sha256', serverConfig.razorpayKeySecret!).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Checks the X-Razorpay-Signature header on webhook calls against the raw request body. */
export function isValidWebhookSignature(rawBody: string, signature: string) {
  if (!serverConfig.razorpayWebhookSecret) return false;
  const expected = createHmac('sha256', serverConfig.razorpayWebhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
