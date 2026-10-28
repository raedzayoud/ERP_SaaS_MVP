import { Role } from './role';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  /** Forced at login when the company administrator asks for a password renewal. */
  mustRenewPassword?: boolean;
}
