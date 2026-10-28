import { Role } from './role';

export interface TenantUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** Inactive users can no longer sign in. */
  active?: boolean;
  /** The administrator forces a password renewal at the next connection. */
  mustRenewPassword?: boolean;
  /** Demo-only: the initial password registered by the administrator. */
  password?: string;
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
