export type PaymentTerms = 'immediate' | 'net15' | 'net30' | 'net60';

export const PAYMENT_TERMS: PaymentTerms[] = ['immediate', 'net15', 'net30', 'net60'];

export const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  immediate: 0,
  net15: 15,
  net30: 30,
  net60: 60,
};
