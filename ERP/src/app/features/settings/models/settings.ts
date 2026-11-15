import { Role } from '../../../core/models/role';

/** Mirrors the backend TeamMemberResponse. IDs are UUID strings. */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustRenewPassword: boolean;
}

export interface CompanySettingsRequest {
  companyName: string;
  currency: string;
  address: string;
  country: string;
  language: string;
  companySize: string;
}

export interface CreateTeamMemberRequest {
  name: string;
  email: string;
  role: Role;
  password: string;
  mustRenewPassword: boolean;
}

export interface UpdateTeamMemberRequest {
  role?: Role;
  active?: boolean;
  mustRenewPassword?: boolean;
}

/** One module the workspace can buy on top of its plan. */
export interface ModuleOffer {
  id: string;
  priceMonthly: number;
  currency: string;
  dependencies: string[];
  /** False when the Stripe price of the module is not configured yet. */
  saleable: boolean;
}

/** The module catalog of the workspace and the modules it already has. */
export interface ModuleCatalog {
  plan: string;
  enabledModules: string[];
  offers: ModuleOffer[];
}

/** The Stripe page the customer has to open to unlock the modules. */
export interface ModulePurchase {
  url: string;
  totalMonthly: number;
  modules: string[];
}
