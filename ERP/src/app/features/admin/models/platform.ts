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
}
