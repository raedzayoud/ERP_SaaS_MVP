import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../shared/models/page';
import { Partner, PartnerInput, PartnerQuery } from '../models/partner';
import { crmError } from './crm-api-error';

/** Customers and suppliers, served by the CRM API. */
@Injectable({ providedIn: 'root' })
export class PartnerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/crm/partners`;

  getPartners(query: PartnerQuery): Observable<Page<Partner>> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.search) params = params.set('search', query.search);
    if (query.kind) params = params.set('kind', query.kind);
    if (query.active !== undefined) params = params.set('active', query.active);
    if (query.sort) params = params.set('sort', query.sort);

    return this.http.get<Page<Partner>>(this.baseUrl, { params });
  }

  getPartner(id: string): Observable<Partner | undefined> {
    return this.http.get<Partner>(`${this.baseUrl}/${id}`).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => crmError(error)),
      ),
    );
  }

  createPartner(data: PartnerInput): Observable<Partner> {
    return this.http
      .post<Partner>(this.baseUrl, data)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  updatePartner(id: string, data: PartnerInput): Observable<Partner> {
    return this.http
      .put<Partner>(`${this.baseUrl}/${id}`, data)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  archivePartner(id: string): Observable<Partner> {
    return this.http
      .patch<Partner>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  restorePartner(id: string): Observable<Partner> {
    return this.http
      .patch<Partner>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }
}
