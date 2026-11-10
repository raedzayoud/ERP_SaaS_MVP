import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  KycReviewStatus,
  SignupDecision,
  SignupReview,
} from '../models/kyc-review';

@Injectable({ providedIn: 'root' })
export class KycAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/signups`;

  list(status: KycReviewStatus): Observable<SignupReview[]> {
    return this.http.get<SignupReview[]>(this.baseUrl, { params: { status } });
  }

  approve(tenantId: string): Observable<SignupDecision> {
    return this.http.post<SignupDecision>(`${this.baseUrl}/${tenantId}/approve`, {});
  }

  reject(tenantId: string, note: string): Observable<SignupDecision> {
    return this.http.post<SignupDecision>(`${this.baseUrl}/${tenantId}/reject`, { note });
  }

  download(tenantId: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${tenantId}/documents/${documentId}`, {
      responseType: 'blob',
    });
  }
}
