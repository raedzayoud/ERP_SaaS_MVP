import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Opportunity, OpportunityInput } from '../models/opportunity';
import { PipelineStats, PipelineStage, pipelineStats } from '../models/pipeline';
import { crmError } from './crm-api-error';

/** Deals of the sales pipeline; won and lost stages are final. */
@Injectable({ providedIn: 'root' })
export class OpportunityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/crm/opportunities`;

  getOpportunities(): Observable<Opportunity[]> {
    return this.http.get<Opportunity[]>(this.baseUrl);
  }

  getOpportunity(id: string): Observable<Opportunity | undefined> {
    return this.http.get<Opportunity>(`${this.baseUrl}/${id}`).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => crmError(error)),
      ),
    );
  }

  stats(): Observable<PipelineStats> {
    return this.getOpportunities().pipe(map((list) => pipelineStats(list)));
  }

  saveDraft(data: OpportunityInput): Observable<Opportunity> {
    const body = {
      name: data.name,
      customerId: data.customerId,
      stage: data.stage,
      amount: data.amount,
      expectedCloseDate: data.expectedCloseDate,
      currency: data.currency,
      notes: data.notes,
    };
    const request = data.id
      ? this.http.put<Opportunity>(`${this.baseUrl}/${data.id}`, body)
      : this.http.post<Opportunity>(this.baseUrl, body);

    return request.pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  deleteOpportunity(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  updateStage(id: string, stage: PipelineStage): Observable<Opportunity> {
    return this.http
      .put<Opportunity>(`${this.baseUrl}/${id}/stage`, { stage })
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }
}
