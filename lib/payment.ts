// Browser-side helpers for Razorpay Checkout. The server creates the order and verifies the result.

export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifiedPayment {
  ticketId: string;
  regNo: string;
  race?: string;
  duplicatePayment?: boolean;
}

export type CheckoutResult ={ status: 'paid'; response: CheckoutSuccess } | { status: 'dismissed' } | { status: 'failed'; reason: string };

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const checkoutScript = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = checkoutScript;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window. Please check your connection.'));
    document.body.appendChild(script);
  });
}

/** Opens the Razorpay payment window and resolves once the runner pays, gives up, or the payment fails. */
export async function openCheckout(order: CheckoutOrder, prefill: { name: string; email: string; contact: string }): Promise<CheckoutResult> {
  await loadCheckout();
  return new Promise((resolve) => {
    // A failed attempt keeps the window open for a retry, so only report it once the runner closes it.
    let lastError: string | undefined;
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'One Indore Run',
      description: 'Indore 2.0 registration',
      prefill,
      theme: { color: '#101613' },
      handler: (response: CheckoutSuccess) => finish({ status: 'paid', response }),
      modal: { ondismiss: () => finish(lastError ? { status: 'failed', reason: lastError } : { status: 'dismissed' }) },
    });
    checkout.on('payment.failed', (response) => {
      lastError = response.error.description ?? 'The payment did not go through.';
    });
    checkout.open();
  });
}

/** POSTs JSON to our API, giving up after a timeout so the button never spins forever. */
export function postJson(url: string, body: unknown, timeoutMs = 45_000) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type VerifyResult =
  | { status: 'confirmed'; payment: VerifiedPayment }
  | { status: 'rejected'; message: string } // e.g. refunded because the race sold out
  | { status: 'unconfirmed' }; // couldn't reach a verdict; the webhook will record it

/**
 * Asks the server to confirm a payment. Confirming twice is harmless, so dropped connections and
 * server hiccups are retried for about 15 seconds of waiting.
 */
export async function verifyPayment(payment: CheckoutSuccess): Promise<VerifyResult> {
  for (const delay of [0, 1_000, 3_000, 5_000, 6_000]) {
    await pause(delay);
    try {
      const response = await postJson('/api/register/verify', payment, 10_000);
      if (response.ok) return { status: 'confirmed', payment: await response.json() };
      if (response.status < 500) {
        // Rejected outright; retrying won't help.
        const body = await response.json().catch(() => ({}));
        return body.message ? { status: 'rejected', message: body.message } : { status: 'unconfirmed' };
      }
    } catch {
      // Network error or timeout: try again.
    }
  }
  return { status: 'unconfirmed' };
}
