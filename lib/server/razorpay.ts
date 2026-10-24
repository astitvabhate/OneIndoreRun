import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverConfig } from './config';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amount_refunded: number;
}

class RazorpayError extends Error {
  constructor(readonly status: number, body: string) {
    super(`Razorpay ${status}: ${body}`);
  }
}

const attempts = 3;
const retryable = (status: number) => status === 429 || status >= 500;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Razorpay's REST API. Timeouts, rate limits and Razorpay outages are retried with backoff;
 * every call made here is safe to repeat (a repeated capture is refused, and callers re-check).
 */
async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${serverConfig.razorpayKeyId}:${serverConfig.razorpayKeySecret}`).toString('base64');
  const send = () =>
    fetch(`https://api.razorpay.com/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

  for (let attempt = 1; ; attempt++) {
    const response = await send().catch((error: unknown) => error as Error); // network error or timeout
    const last = attempt === attempts;
    if (response instanceof Response) {
      if (response.ok) return response.json();
      if (last || !retryable(response.status)) throw new RazorpayError(response.status, await response.text());
    } else if (last) {
      throw response;
    }
    await pause(300 * 2 ** (attempt - 1) + Math.random() * 200);
  }
}

/** Creates an order. Amount is in paise. A retry that leaves an extra unpaid order behind is harmless. */
export const createOrder = (amount: number, receipt: string, notes: Record<string, string>) =>
  razorpay<RazorpayOrder>('/orders', { amount, currency: 'INR', receipt, notes });

export const fetchPayment = (paymentId: string) => razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);

/**
 * Makes sure a payment for this order is captured (money actually taken), capturing it if it is
 * only authorised. This works whatever the Razorpay dashboard's auto-capture setting is.
 * Returns the payment; its status is 'captured' unless it failed or was refunded.
 */
export async function ensureCaptured(paymentId: string, orderId: string) {
  const payment = await fetchPayment(paymentId);
  if (payment.order_id !== orderId) throw new Error(`Payment ${paymentId} belongs to order ${payment.order_id}, not ${orderId}`);
  if (payment.status !== 'authorized') return payment;
  try {
    return await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { amount: payment.amount, currency: payment.currency });
  } catch {
    // Most likely captured meanwhile (auto-capture, or the webhook and browser racing): look again.
    return fetchPayment(paymentId);
  }
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
