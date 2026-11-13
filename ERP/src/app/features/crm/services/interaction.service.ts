import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CrmInteraction, CrmInteractionInput } from '../models/crm-interaction';
import { crmCode, crmError } from './crm-api-error';

/** Calls, emails, meetings and notes recorded on a contact. */
@Injectable({ providedIn: 'root' })
export class InteractionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/crm/interactions`;
  private readonly partnersUrl = `${environment.apiUrl}/crm/partners`;

  getForPartner(partnerId: string): Observable<CrmInteraction[]> {
    return this.http
      .get<CrmInteraction[]>(`${this.partnersUrl}/${partnerId}/interactions`)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  getPendingReminders(): Observable<CrmInteraction[]> {
    return this.http
      .get<CrmInteraction[]>(`${this.baseUrl}/reminders`)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  save(input: CrmInteractionInput): Observable<CrmInteraction> {
    if (!input.subject.trim()) {
      return throwError(() => crmCode('noSubject'));
    }

    const body = {
      type: input.type,
      date: input.date,
      subject: input.subject,
      notes: input.notes,
      reminderAt: input.reminderAt,
    };
    const request = input.id
      ? this.http.put<CrmInteraction>(`${this.baseUrl}/${input.id}`, body)
      : this.http.post<CrmInteraction>(`${this.partnersUrl}/${input.partnerId}/interactions`, body);

    return request.pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }

  markReminderDone(id: string): Observable<CrmInteraction> {
    return this.http
      .put<CrmInteraction>(`${this.baseUrl}/${id}/reminder-done`, {})
      .pipe(catchError((error: unknown) => throwError(() => crmError(error))));
  }
}
