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
