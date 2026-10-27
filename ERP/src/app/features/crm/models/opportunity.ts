export interface Opportunity {
  id: string;
  name: string;
  customerId: string;
  stage: string;
  amount: number;
  currency: string;
  expectedCloseDate: string;
  notes: string;
  originLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityInput {
  id: string | null;
  name: string;
  customerId: string;
  stage: string;
  amount: number;
  /** Optional: new opportunities always start in USD. */
  currency?: string;
  expectedCloseDate: string;
  notes: string;
}
