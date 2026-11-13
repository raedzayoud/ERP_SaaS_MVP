import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { LeadForm } from './lead-form';
import { LeadService } from '../../services/lead.service';
import { Lead, LeadInput } from '../../models/lead';

const EN = {
  crm: {
    leads: {
      newTitle: 'New lead',
      editTitle: 'Edit lead',
      form: { name: 'Name', email: 'Email', phone: 'Phone', source: 'Source', notes: 'Notes' },
      source: { website: 'Website', referral: 'Referral', event: 'Event' },
    },
    errors: {
      noName: 'Please enter a name.',
      badEmail: 'The email address is not valid.',
      noContactInfo: 'Please enter an email address or a phone number.',
    },
  },
  common: { loading: 'Loading…', back: 'Back' },
};

const SAVED_LEAD: Lead = {
  id: 'l1',
  name: 'Nadia Trabelsi',
  company: 'Carthage Logistics',
  email: 'nadia@example.com',
  phone: '',
  source: 'website',
  status: 'new',
  convertedPartnerId: null,
  notes: '',
  createdAt: '2026-10-18T09:00:00.000Z',
  updatedAt: '2026-10-18T09:00:00.000Z',
};

describe('LeadForm', () => {
  let saved: LeadInput[];

  function setup(): ComponentFixture<LeadForm> {
    saved = [];

    TestBed.configureTestingModule({
      imports: [
        LeadForm,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        {
          provide: LeadService,
          useValue: {
            getLead: () => of(undefined),
            saveDraft: (input: LeadInput) => {
              saved.push(input);
              return of({ ...SAVED_LEAD, ...input });
            },
            deleteLead: () => of(undefined),
            loseLead: () => of(SAVED_LEAD),
            convertLead: () => of({ partnerId: 'p1', lead: SAVED_LEAD }),
          },
        },
      ],
    });

    return TestBed.createComponent(LeadForm);
  }

  async function render(fixture: ComponentFixture<LeadForm>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setInput(el: HTMLElement, id: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Missing input #${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitForm(fixture: ComponentFixture<LeadForm>): void {
    const form = (fixture.nativeElement as HTMLElement).querySelector('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('requires an email address or a phone number', async () => {
    const fixture = setup();
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'name', 'Nadia Trabelsi');
    submitForm(fixture);
    await render(fixture);

    expect(el.textContent).toContain('Please enter an email address or a phone number.');
    expect(saved.length).toBe(0);
  });

  it('saves a lead that only has a phone number', async () => {
    const fixture = setup();
    await render(fixture);

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'name', 'Nadia Trabelsi');
    setInput(el, 'phone', '+216 71 000 001');
    submitForm(fixture);
    await render(fixture);

    expect(saved.length).toBe(1);
    expect(saved[0].phone).toBe('+216 71 000 001');
    expect(navigate).toHaveBeenCalledWith(['/leads']);
  });
});
