export type PaymentStatus = 'pending' | 'paid' | 'failed';
export interface PaymentService { beginPayment(amount: number, registrationId: string): Promise<PaymentStatus>; }
export const paymentService: PaymentService = { async beginPayment() { return 'pending'; } };
