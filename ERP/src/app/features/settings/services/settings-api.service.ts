import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthTenantResponse } from '../../../core/models/auth';
import {
  CompanySettingsRequest,
  ModuleCatalog,
  ModulePurchase,
  TeamMember,
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

  getModules(): Observable<ModuleCatalog> {
    return this.http.get<ModuleCatalog>(`${this.baseUrl}/modules`);
  }

  addModules(modules: string[]): Observable<ModulePurchase> {
    return this.http.post<ModulePurchase>(`${this.baseUrl}/modules`, { modules });
  }
}
