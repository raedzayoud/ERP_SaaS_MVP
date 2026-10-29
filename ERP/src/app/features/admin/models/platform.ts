export type PlatformTenantStatus = 'trial' | 'active' | 'suspended';

export interface PlatformTenant {
  id: number;
  companyName: string;
  subdomain: string;
  email: string;
  planId: string;
  status: PlatformTenantStatus;
  usersCount: number;
  storageUsedGb: number;
  createdAt: string;
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

/** A company asking to join the platform (validated by the super-admin with KYC). */
export type SignupStatus = 'pending' | 'approved' | 'rejected';

/**
 * One KYC document of a signup request. Seed data only says "submitted",
 * while requests filed by the signup wizard carry the real chosen file.
 */
export type KycDocument =
  | { kind: 'submitted' }
  | { kind: 'uploaded'; fileName: string; sizeKb: number; dataUrl?: string };

export type SignupRequestDocuments = {
  idCard: KycDocument;
  tradeRegister: KycDocument;
  taxRegistration: KycDocument;
};

export interface SignupRequest {
  id: number;
  companyName: string;
  subdomain: string;
  email: string;
  country: string;
  planId: string;
  status: SignupStatus;
  /** KYC documents requested at registration. */
  documents: SignupRequestDocuments;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** One monthly subscription statement of one tenant. */
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface SubscriptionPayment {
  id: number;
  tenantId: number;
  /** Billing period, formatted as YYYY-MM. */
  period: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
}
