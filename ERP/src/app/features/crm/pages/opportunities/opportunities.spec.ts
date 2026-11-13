import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { Opportunities } from './opportunities';
import { OpportunityService } from '../../services/opportunity.service';
import { PartnerService } from '../../services/partner.service';
import { Opportunity } from '../../models/opportunity';
import { PipelineStage, pipelineStats } from '../../models/pipeline';

const EN = {
  crm: {
    opportunities: {
      title: 'Opportunities',
      subtitle: 'Follow your deals through the sales pipeline.',
      newOpportunity: 'New opportunity',
      loadError: 'Unable to load opportunities.',
      emptyTitle: 'No opportunities yet',
      columnEmpty: 'No deal in this stage',
      changeStage: 'Change stage',
      expectedClose: 'Expected close',
      viewCustomerFor: 'Open the contact page of {{name}}',
      deleteFor: 'Delete opportunity {{name}}',
      saveError: 'Could not save the opportunity.',
      stageError: 'Stage change failed.',
      kpi: { openCount: 'Open deals', openAmount: 'Open pipeline', wonAmount: 'Won revenue', winRate: 'Win rate' },
    },
    pipeline: {
      stage: {
        qualification: 'Qualification',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        won: 'Won',
        lost: 'Lost',
      },
    },
    errors: { stageClosed: 'This deal is closed and cannot change any more.' },
  },
  common: { loading: 'Loading…', retry: 'Try again', errorHint: 'Try again later.', edit: 'Edit' },
};

function opportunity(overrides: Partial<Opportunity>): Opportunity {
  return {
    id: 'op-1',
    name: 'Carthage Logistics rollout',
    customerId: 'p1',
    stage: 'qualification',
    amount: 24000,
    currency: 'USD',
    expectedCloseDate: '2026-11-20',
    notes: '',
    originLeadId: null,
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
    ...overrides,
  };
}

const OPEN_DEAL = opportunity({ id: 'op-1', stage: 'qualification' });
const WON_DEAL = opportunity({ id: 'op-2', name: 'Horizon founder pack', stage: 'won' });

/** Minimal drag event: jsdom has no DataTransfer implementation. */
function dragEvent(type: string, data: Record<string, string> = {}): DragEvent {
  const store = new Map(Object.entries(data));
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      setData: (key: string, value: string) => store.set(key, value),
      getData: (key: string) => store.get(key) ?? '',
      effectAllowed: '',
      dropEffect: '',
    },
  });
  return event as unknown as DragEvent;
}

describe('Opportunities', () => {
  function setup(
    updateStage: (id: string, stage: PipelineStage) => Observable<Opportunity>,
  ): ComponentFixture<Opportunities> {
    const deals = [OPEN_DEAL, WON_DEAL];

    TestBed.configureTestingModule({
      imports: [
        Opportunities,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: OpportunityService,
          useValue: {
            getOpportunities: () => of(deals),
            getOpportunity: () => of(undefined),
            stats: () => of(pipelineStats(deals)),
            saveDraft: () => of(OPEN_DEAL),
            deleteOpportunity: () => of(undefined),
            updateStage,
          },
        },
        {
          provide: PartnerService,
          useValue: {
            getPartners: () =>
              of({
                items: [
                  {
                    id: 'p1',
                    kind: 'company',
                    name: 'Acme Corp',
                    parentId: null,
                    isCustomer: true,
                    isSupplier: false,
                    taxId: '',
                    email: '',
                    phone: '',
                    jobTitle: '',
                    address: { street: '', city: '', country: '' },
                    active: true,
                    notes: '',
                    createdAt: '',
                    updatedAt: '',
                  },
                ],
                total: 1,
                page: 0,
                size: 1,
              }),
          },
        },
      ],
    });

    return TestBed.createComponent(Opportunities);
  }

  function columnOf(fixture: ComponentFixture<Opportunities>, stage: string): HTMLElement {
    const column = (fixture.nativeElement as HTMLElement).querySelector(
      `.kanban-col[data-stage="${stage}"]`,
    );
    return column as HTMLElement;
  }

  it('moves a card to the column it is dropped on', async () => {
    const calls: string[] = [];
    const fixture = setup((id, stage) => {
      calls.push(`${id}:${stage}`);
      return of(opportunity({ id, stage }));
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.onDragStart(OPEN_DEAL, dragEvent('dragstart'));
    component.onDrop('proposal', dragEvent('drop', { 'text/plain': OPEN_DEAL.id }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(calls).toEqual(['op-1:proposal']);
    expect(columnOf(fixture, 'proposal').textContent).toContain('Carthage Logistics rollout');
    expect(columnOf(fixture, 'qualification').textContent).not.toContain('Carthage Logistics rollout');
  });

  it('ignores a card dropped on its own column', async () => {
    const calls: string[] = [];
    const fixture = setup((id, stage) => {
      calls.push(`${id}:${stage}`);
      return of(opportunity({ id, stage }));
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onDrop('qualification', dragEvent('drop', { 'text/plain': OPEN_DEAL.id }));
    await fixture.whenStable();

    expect(calls).toEqual([]);
  });

  it('does not let a closed card be dragged', async () => {
    const fixture = setup(() => of(OPEN_DEAL));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.kanban-card');
    const open = cards[0].getAttribute('draggable');
    const closed = cards[1].getAttribute('draggable');
    expect(open).toBe('true');
    expect(closed).toBe('false');
  });

  it('puts the card back when the API refuses the move', async () => {
    const fixture = setup(() => throwError(() => Object.assign(new Error('closed'), { code: 'stageClosed' })));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.onDrop('proposal', dragEvent('drop', { 'text/plain': OPEN_DEAL.id }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(columnOf(fixture, 'qualification').textContent).toContain('Carthage Logistics rollout');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This deal is closed and cannot change any more.',
    );
  });
});
