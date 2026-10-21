export interface TenantUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Tenant {
  id: number;
  companyName: string;
  email: string;
  subdomain: string;
  country: string;
  language: string;
  companySize: string;
  planId: string;
  enabledModules: string[];
  users: TenantUser[];
  currency: string;
  taxId: string;
  address: string;
  createdAt: string;
}
