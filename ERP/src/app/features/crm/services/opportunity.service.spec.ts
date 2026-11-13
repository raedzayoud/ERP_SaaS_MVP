import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OpportunityService } from './opportunity.service';

describe('OpportunityService', () => {
  let service: OpportunityService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/crm/opportunities`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OpportunityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('computes the pipeline statistics over the API list', async () => {
    const stats = firstValueFrom(service.stats());

    http.expectOne(baseUrl).flush([
      { id: 'op-1', stage: 'qualification', amount: 100 },
      { id: 'op-2', stage: 'won', amount: 50 },
      { id: 'op-3', stage: 'lost', amount: 25 },
    ]);

    const result = await stats;
    expect(result.openCount).toBe(1);
    expect(result.openAmount).toBe(100);
    expect(result.wonAmount).toBe(50);
    expect(result.winRate).toBe(50);
  });

  it('moves an open deal to another stage', async () => {
    const moved = firstValueFrom(service.updateStage('op-1', 'negotiation'));

    const request = http.expectOne(`${baseUrl}/op-1/stage`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ stage: 'negotiation' });
    request.flush({ id: 'op-1', stage: 'negotiation' });

    expect((await moved).stage).toBe('negotiation');
  });

  it('creates a deal', async () => {
    const created = firstValueFrom(
      service.saveDraft({
        id: null,
        name: 'Carthage rollout',
        customerId: 'partner-1',
        stage: 'qualification',
        amount: 24000,
        expectedCloseDate: '2026-11-20',
        notes: '',
      }),
    );

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.customerId).toBe('partner-1');
    request.flush({ id: 'op-1', stage: 'qualification' });

    expect((await created).id).toBe('op-1');
  });

  it('keeps the error code returned by the API', async () => {
    const failure = firstValueFrom(service.updateStage('op-1', 'proposal'));

    http
      .expectOne(`${baseUrl}/op-1/stage`)
      .flush(
        { message: 'closed opportunity cannot change stage', code: 'stageClosed' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(failure).rejects.toMatchObject({ code: 'stageClosed' });
  });
});
