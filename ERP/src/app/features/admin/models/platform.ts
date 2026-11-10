export type PlatformTenantStatus = 'trial' | 'active' | 'suspended';

export interface PlatformTenant {
  id: string;
  companyName: string;
  subdomain: string;
  email: string;
  /** Tax-registration number (matricule fiscal), kept from signup approval. */
  taxId?: string;
  planId: string;
  status: PlatformTenantStatus;
  usersCount: number;
  storageUsedGb: number;
  createdAt: string;
  kycStatus?: string;
  billingStatus?: string;
  billingInterval?: string;
  currentPeriodEnd?: string;
  trialUsed?: number;
  trialLimit?: number;
  trialStartedAt?: string;
  trialEndedAt?: string;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  monthlyRevenue: number;
  /** Signup requests waiting for a KYC decision. */
  pendingSignups: number;
  /** Money expected from overdue subscription payments. */
  overdueAmount: number;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface SubscriptionPayment {
  id: string;
  tenantId: string;
  /** Billing period, formatted as YYYY-MM. */
  period: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  invoiceUrl?: string;
}
