import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Employee, EmployeeInput } from '../models/employee';
import { LeaveRequest, LeaveRequestInput, LeaveStatus } from '../models/leave-request';

@Injectable({ providedIn: 'root' })
export class HrApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/hr`;

  getEmployees(search?: string, status?: string): Observable<Employee[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    return this.http.get<Employee[]>(`${this.baseUrl}/employees`, { params });
  }

  getEmployee(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.baseUrl}/employees/${id}`);
  }

  createEmployee(input: EmployeeInput): Observable<Employee> {
    return this.http.post<Employee>(`${this.baseUrl}/employees`, input);
  }

  updateEmployee(id: string, input: EmployeeInput): Observable<Employee> {
    return this.http.put<Employee>(`${this.baseUrl}/employees/${id}`, input);
  }

  deleteEmployee(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/employees/${id}`);
  }

  getLeaveRequests(status?: string, employeeId?: string): Observable<LeaveRequest[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (employeeId) params = params.set('employeeId', employeeId);
    return this.http.get<LeaveRequest[]>(`${this.baseUrl}/leave-requests`, { params });
  }

  createLeaveRequest(input: LeaveRequestInput): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`${this.baseUrl}/leave-requests`, input);
  }

  updateLeaveStatus(id: string, status: LeaveStatus): Observable<LeaveRequest> {
    return this.http.put<LeaveRequest>(`${this.baseUrl}/leave-requests/${id}/status`, { status });
  }

  deleteLeaveRequest(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leave-requests/${id}`);
  }
}
