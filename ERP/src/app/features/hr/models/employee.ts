import { Role, TENANT_ROLES } from '../../../core/models/role';

export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  position: string;
  hireDate: string;
  status: EmployeeStatus;
  createdAt: string;
  hasAccount: boolean;
}

export interface EmployeeInput {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  position: string;
  hireDate: string;
  status: EmployeeStatus;
  /** Only used on creation: creates the login account of the employee. */
  password?: string;
}

/** The roles an employee can hold: the application roles, without the external client. */
export const EMPLOYEE_ROLES: Role[] = TENANT_ROLES.filter((role) => role !== 'client-externe');
