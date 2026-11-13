import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InteractionService } from './interaction.service';

describe('InteractionService', () => {
  let service: InteractionService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/crm/interactions`;
  const partnersUrl = `${environment.apiUrl}/crm/partners`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InteractionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the history of one contact', async () => {
    const history = firstValueFrom(service.getForPartner('partner-1'));

    const request = http.expectOne(`${partnersUrl}/partner-1/interactions`);
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'int-1', subject: 'Follow-up' }]);

    expect((await history).length).toBe(1);
  });

  it('lists the pending reminders', async () => {
    const reminders = firstValueFrom(service.getPendingReminders());

    const request = http.expectOne(`${baseUrl}/reminders`);
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'int-1', reminderAt: '2026-10-27' }]);

    expect((await reminders).length).toBe(1);
  });

  it('creates an interaction on a contact', async () => {
    const created = firstValueFrom(
      service.save({
        id: null,
        partnerId: 'partner-1',
        type: 'call',
        date: '2026-10-21',
        subject: 'Follow-up',
        notes: 'notes',
        reminderAt: '2026-10-27',
      }),
    );

    const request = http.expectOne(`${partnersUrl}/partner-1/interactions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.subject).toBe('Follow-up');
    request.flush({ id: 'int-1', subject: 'Follow-up' });

    expect((await created).id).toBe('int-1');
  });

  it('refuses an interaction without a subject before calling the API', async () => {
    await expect(
      firstValueFrom(
        service.save({
          id: null,
          partnerId: 'partner-1',
          type: 'call',
          date: '2026-10-21',
          subject: '  ',
          notes: '',
          reminderAt: null,
        }),
      ),
    ).rejects.toMatchObject({ code: 'noSubject' });

    http.verify();
  });

  it('marks a reminder as done', async () => {
    const done = firstValueFrom(service.markReminderDone('int-1'));

    const request = http.expectOne(`${baseUrl}/int-1/reminder-done`);
    expect(request.request.method).toBe('PUT');
    request.flush({ id: 'int-1', reminderDone: true });

    expect((await done).reminderDone).toBe(true);
  });
});
