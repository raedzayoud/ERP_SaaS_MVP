export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  status: EmployeeStatus;
  createdAt: string;
}

export interface EmployeeInput {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  status: EmployeeStatus;
}
