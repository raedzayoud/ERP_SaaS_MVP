import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { KnowledgeArticle, KnowledgeArticleInput } from '../models/knowledge-article';
import { InteractionInput, TicketInteraction } from '../models/ticket-interaction';
import { SupportTicket, SupportTicketInput } from '../models/support-ticket';

@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/support`;

  getTickets(search?: string, status?: string, type?: string): Observable<SupportTicket[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (type) params = params.set('type', type);
    return this.http.get<SupportTicket[]>(`${this.baseUrl}/tickets`, { params });
  }

  getTicket(id: string): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.baseUrl}/tickets/${id}`);
  }

  createTicket(input: SupportTicketInput): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`${this.baseUrl}/tickets`, input);
  }

  updateTicket(id: string, input: SupportTicketInput): Observable<SupportTicket> {
    return this.http.put<SupportTicket>(`${this.baseUrl}/tickets/${id}`, input);
  }

  deleteTicket(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tickets/${id}`);
  }

  getInteractions(ticketId: string): Observable<TicketInteraction[]> {
    return this.http.get<TicketInteraction[]>(
      `${this.baseUrl}/tickets/${ticketId}/interactions`,
    );
  }

  addInteraction(ticketId: string, input: InteractionInput): Observable<TicketInteraction> {
    return this.http.post<TicketInteraction>(
      `${this.baseUrl}/tickets/${ticketId}/interactions`,
      input,
    );
  }

  getArticles(): Observable<KnowledgeArticle[]> {
    return this.http.get<KnowledgeArticle[]>(`${this.baseUrl}/articles`);
  }

  createArticle(input: KnowledgeArticleInput): Observable<KnowledgeArticle> {
    return this.http.post<KnowledgeArticle>(`${this.baseUrl}/articles`, input);
  }

  updateArticle(id: string, input: KnowledgeArticleInput): Observable<KnowledgeArticle> {
    return this.http.put<KnowledgeArticle>(`${this.baseUrl}/articles/${id}`, input);
  }

  deleteArticle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/articles/${id}`);
  }
}
