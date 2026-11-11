import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthTenantResponse } from '../../../core/models/auth';
import {
  CompanySettingsRequest,
  CreateTeamMemberRequest,
  TeamMember,
  UpdateTeamMemberRequest,
} from '../models/settings';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings`;

  getCompany(): Observable<AuthTenantResponse> {
    return this.http.get<AuthTenantResponse>(`${this.baseUrl}/company`);
  }

  updateCompany(request: CompanySettingsRequest): Observable<AuthTenantResponse> {
    return this.http.put<AuthTenantResponse>(`${this.baseUrl}/company`, request);
  }

  getUsers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.baseUrl}/users`);
  }

  createUser(request: CreateTeamMemberRequest): Observable<TeamMember> {
    return this.http.post<TeamMember>(`${this.baseUrl}/users`, request);
  }

  updateUser(id: string, request: UpdateTeamMemberRequest): Observable<TeamMember> {
    return this.http.patch<TeamMember>(`${this.baseUrl}/users/${id}`, request);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${id}`);
  }
}
