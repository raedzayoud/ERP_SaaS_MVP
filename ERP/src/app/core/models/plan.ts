export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  maxUsers: number;
  storageGb: number;
  aiQuota: number;
  modules: string[];
  features: string[];
  popular?: boolean;
}
