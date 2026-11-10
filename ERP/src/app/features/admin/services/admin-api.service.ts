import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Plan } from '../../../core/models/plan';
import {
  PlatformStats,
  PlatformTenant,
  PlatformTenantStatus,
  SubscriptionPayment,
} from '../models/platform';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.baseUrl}/stats`);
  }

  getTenants(): Observable<PlatformTenant[]> {
    return this.http.get<PlatformTenant[]>(`${this.baseUrl}/tenants`);
  }

  updateTenantStatus(
    tenantId: string,
    status: Extract<PlatformTenantStatus, 'active' | 'suspended'>,
  ): Observable<PlatformTenant> {
    return this.http.put<PlatformTenant>(`${this.baseUrl}/tenants/${tenantId}/status`, {
      status: status.toUpperCase(),
    });
  }

  getPayments(): Observable<SubscriptionPayment[]> {
    return this.http.get<SubscriptionPayment[]>(`${this.baseUrl}/payments`);
  }

  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.baseUrl}/plans`);
  }
}
