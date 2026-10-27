import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { OpportunityService } from './opportunity.service';

const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const NEGOTIATION_ONE = 'd5000000-0000-4000-8000-000000000003';
const WON_ONE = 'd5000000-0000-4000-8000-000000000004';

describe('OpportunityService', () => {
  let service: OpportunityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpportunityService);
  });

  it('computes pipeline statistics over the seed data', async () => {
    const stats = await firstValueFrom(service.stats());

    // Seeds: 3 open, 2 won (6400 + 5200), 1 lost
    expect(stats.openCount).toBe(3);
    expect(stats.openAmount).toBe(52300);
    expect(stats.wonAmount).toBe(11600);
    expect(stats.winRate).toBe(67);
  });

  it('moves an open deal to another open stage', async () => {
    const updated = await firstValueFrom(
      service.updateStage(NEGOTIATION_ONE, 'proposal'),
    );

    expect(updated.stage).toBe('proposal');
  });

  it('freezes closed (won) deals: their stage cannot change', async () => {
    const promise = firstValueFrom(service.updateStage(WON_ONE, 'negotiation'));

    await expect(promise).rejects.toMatchObject({ code: 'stageClosed' });
  });

  it('refuses an unknown stage', async () => {
    const promise = firstValueFrom(
      service.updateStage(NEGOTIATION_ONE, 'garbage' as never),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invalidStage' });
  });

  it('validates amount and customer on save', async () => {
    const noAmount = firstValueFrom(
      service.saveDraft({
        id: null,
        name: 'New deal',
        customerId: ACME,
        stage: 'qualification',
        amount: 0,
        expectedCloseDate: '2026-12-01',
        notes: '',
      }),
    );
    await expect(noAmount).rejects.toMatchObject({ code: 'invalidAmount' });

    const noCustomer = firstValueFrom(
      service.saveDraft({
        id: null,
        name: 'New deal',
        customerId: 'unknown-partner',
        stage: 'qualification',
        amount: 500,
        expectedCloseDate: '2026-12-01',
        notes: '',
      }),
    );
    await expect(noCustomer).rejects.toMatchObject({ code: 'noCustomer' });
  });
});
