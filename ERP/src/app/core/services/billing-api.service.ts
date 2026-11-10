import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BillingInterval } from '../models/auth';
import { BillingStatusResponse, BillingUrlResponse } from '../models/billing';

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/billing`;

  checkout(interval: BillingInterval): Observable<BillingUrlResponse> {
    return this.http.post<BillingUrlResponse>(`${this.baseUrl}/checkout-session`, { interval });
  }

  subscription(): Observable<BillingStatusResponse> {
    return this.http.get<BillingStatusResponse>(`${this.baseUrl}/subscription`);
  }

  refresh(): Observable<BillingStatusResponse> {
    return this.http.post<BillingStatusResponse>(`${this.baseUrl}/refresh`, {});
  }

  portal(): Observable<BillingUrlResponse> {
    return this.http.post<BillingUrlResponse>(`${this.baseUrl}/portal-session`, {});
  }
}
