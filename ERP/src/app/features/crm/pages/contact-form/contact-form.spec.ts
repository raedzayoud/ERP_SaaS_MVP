import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ContactForm } from './contact-form';
import { PartnerService } from '../../services/partner.service';
import { Partner, PartnerInput, PartnerQuery } from '../../models/partner';
import { Page } from '../../../../shared/models/page';

const EN = {
  contacts: {
    kind: { company: 'Company', person: 'Person' },
    tags: { customer: 'Customer', supplier: 'Supplier' },
    form: {
      newTitle: 'New contact',
      editTitle: 'Edit contact',
      emailInvalid: 'Enter a valid email address.',
      nameRequired: 'A name is required.',
      notFound: 'Contact not found',
      save: 'Save contact',
      saving: 'Saving…',
    },
  },
  common: {
    back: 'Back',
    cancel: 'Cancel',
    loading: 'Loading…',
  },
};

const SAVED_PARTNER: Partner = {
  id: 'p1',
  kind: 'company',
  name: 'Acme Corp',
  parentId: null,
  isCustomer: true,
  isSupplier: false,
  taxId: '',
  email: 'billing@acme-corp.com',
  phone: '',
  jobTitle: '',
  address: { street: '', city: '', country: 'TN' },
  active: true,
  notes: '',
  createdAt: '2026-01-12T09:00:00.000Z',
  updatedAt: '2026-01-12T09:00:00.000Z',
};

function pageOf(items: Partner[]): Page<Partner> {
  return { items, total: items.length, page: 0, size: Math.max(items.length, 1) };
}

function submitForm(fixture: ComponentFixture<ContactForm>): void {
  const form = (fixture.nativeElement as HTMLElement).querySelector('form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function setInput(el: HTMLElement, id: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing input #${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ContactForm', () => {
  let created: PartnerInput[];

  function setup(options: { partnerId?: string; getPartner?: () => Partner | undefined } = {}) {
    created = [];

    TestBed.configureTestingModule({
      imports: [
        ContactForm,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(options.partnerId ? { id: options.partnerId } : {}),
            },
          },
        },
        {
          provide: PartnerService,
          useValue: {
            getPartners: (query: PartnerQuery) => of(pageOf([])),
            getPartner: () => of(options.getPartner ? options.getPartner() : undefined),
            createPartner: (input: PartnerInput) => {
              created.push(input);
              return of({ ...SAVED_PARTNER, ...input });
            },
            updatePartner: (id: string, input: PartnerInput) => {
              created.push(input);
              return of({ ...SAVED_PARTNER, id, ...input });
            },
            archivePartner: () => of(SAVED_PARTNER),
            restorePartner: () => of(SAVED_PARTNER),
          },
        },
      ],
    });

    return TestBed.createComponent(ContactForm);
  }

  async function render(fixture: ComponentFixture<ContactForm>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the name error when the form is submitted empty', async () => {
    const fixture = setup();
    await render(fixture);

    submitForm(fixture);
    await render(fixture);

    const error = (fixture.nativeElement as HTMLElement).querySelector('#name-error');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain('A name is required.');
  });

  it('shows the email error when the email is not valid', async () => {
    const fixture = setup();
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'name', 'Acme Corp');
    setInput(el, 'email', 'not-an-email');
    submitForm(fixture);
    await render(fixture);

    const error = el.querySelector('#email-error');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain('Enter a valid email address.');
    expect(created.length).toBe(0);
  });

  it('saves a valid contact and goes back to the list', async () => {
    const fixture = setup();
    await render(fixture);

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'name', 'Acme Corp');
    setInput(el, 'email', 'billing@acme-corp.com');
    submitForm(fixture);
    await render(fixture);

    expect(created.length).toBe(1);
    expect(created[0].name).toBe('Acme Corp');
    expect(navigate).toHaveBeenCalledWith(['/contacts']);
  });

  it('shows the not found state for an unknown contact', async () => {
    const fixture = setup({ partnerId: 'unknown-id' });
    await render(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Contact not found');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });
});
