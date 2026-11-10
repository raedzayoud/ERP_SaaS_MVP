export interface BillingUrlResponse {
  url: string;
}

export interface BillingStatusResponse {
  planId: string;
  billingStatus: string;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}
