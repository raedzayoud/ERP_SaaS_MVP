import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../shared/models/page';
import { Lead, LeadInput, LeadQuery, LeadSource } from '../models/lead';
import { crmCode, crmError } from './crm-api-error';

/** Leads waiting to be contacted, converted into contacts or marked as lost. */
@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/crm/leads`;

  getLeads(query: LeadQuery): Observable<Page<Lead>> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);

    return this.http.get<Page<Lead>>(this.baseUrl, { params });
  }

  getLead(id: string): Observable<Lead | undefined> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => crmError(error)),
      ),
    );
  }

  saveDraft(data: LeadInput): Observable<Lead> {
    if (!data.name.trim()) {
      return throwError(() => crmCode('noName'));
    }

    const body = {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      source: data.source,
      notes: data.notes,
    };
    const request = data.id
      ? this.http.put<Lead>(`${this.baseUrl}/${data.id}`, body)
      : this.http.post<Lead>(this.baseUrl, body);

    return request.pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  deleteLead(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  loseLead(id: string): Observable<Lead> {
    return this.http
      .post<Lead>(`${this.baseUrl}/${id}/lose`, {})
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  /** Turns the lead into a real contact and keeps the link on the lead. */
  convertLead(id: string): Observable<{ partnerId: string; lead: Lead }> {
    return this.http
      .post<{ partnerId: string; lead: Lead }>(`${this.baseUrl}/${id}/convert`, {})
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  sourceLabelKey(source: LeadSource): string {
    return `crm.leads.source.${source}`;
  }
}
