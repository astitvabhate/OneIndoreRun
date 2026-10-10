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

export type CheckoutResult = { status: 'paid'; response: CheckoutSuccess } | { status: 'dismissed' } | { status: 'failed'; reason: string };

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
