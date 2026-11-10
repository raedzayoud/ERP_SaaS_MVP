import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SupportApiService } from './support-api.service';

describe('SupportApiService', () => {
  let api: SupportApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SupportApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads tickets with filters', () => {
    api.getTickets('login', 'open', 'ticket').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/support/tickets?search=login&status=open&type=ticket`,
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates a ticket', () => {
    const input = {
      subject: 'Cannot log in',
      description: 'The login page rejects my password.',
      requesterName: 'Ada Lovelace',
      requesterEmail: 'ada@example.com',
      type: 'ticket' as const,
      priority: 'high' as const,
      status: 'open' as const,
      assignee: '',
    };

    api.createTicket(input).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/support/tickets`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({});
  });

  it('adds an interaction to a ticket', () => {
    const input = { author: 'Ada', channel: 'note' as const, message: 'Looking into it.' };

    api.addInteraction('ticket-1', input).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/support/tickets/ticket-1/interactions`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({});
  });

  it('deletes an article', () => {
    api.deleteArticle('article-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/support/articles/article-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
