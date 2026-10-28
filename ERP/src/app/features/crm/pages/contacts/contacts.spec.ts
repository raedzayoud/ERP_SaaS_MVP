import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { Contacts } from './contacts';
import { PartnerService } from '../../services/partner.service';
import { Partner, PartnerQuery } from '../../models/partner';
import { Page } from '../../../../shared/models/page';
import { AuthService } from '../../../../core/services/auth.service';

const EN = {
  contacts: {
    title: 'Contacts',
    newContact: 'New contact',
    loadError: 'Contacts could not be loaded',
    emptyTitle: 'No contacts yet',
    noMatch: 'No contacts match your search',
    archived: 'Contact archived',
    archive: 'Archive',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
  },
};

function partner(overrides: Partial<Partner>): Partner {
  return {
    id: 'p1',
    kind: 'company',
    name: 'Acme Corp',
    parentId: null,
    isCustomer: true,
    isSupplier: false,
    taxId: '',
    email: 'billing@acme-corp.com',
    phone: '+1 415 555 0110',
    jobTitle: '',
    address: { street: '120 Market Street', city: 'San Francisco', country: 'US' },
    active: true,
    notes: '',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
    ...overrides,
  };
}

const ACTIVE_PARTNERS: Partner[] = [
  partner({ id: 'p1', name: 'Acme Corp' }),
  partner({ id: 'p2', name: 'Global Ltd', email: 'accounts@global-ltd.co.uk' }),
  partner({ id: 'p3', kind: 'person', name: 'John Smith', parentId: 'p1' }),
];

function pageOf(items: Partner[]): Page<Partner> {
  return { items, total: items.length, page: 0, size: Math.max(items.length, 1) };
}

function listPartners(data: Partner[], query: PartnerQuery): Observable<Page<Partner>> {
  const companies = data.filter((item) => item.kind === 'company');
  if (query.kind === 'company') return of(pageOf(companies));

  const items = data.filter((item) => query.active === undefined || item.active === query.active);
  return of(pageOf(items));
}

async function render(fixture: ComponentFixture<Contacts>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Contacts', () => {
  function setup(
    options: {
      data?: Partner[];
      list?: (query: PartnerQuery) => Observable<Page<Partner>>;
    } = {},
  ): ComponentFixture<Contacts> {
    const data = options.data ?? [...ACTIVE_PARTNERS];

    const list = options.list ?? ((query: PartnerQuery) => listPartners(data, query));

    function update(id: string, active: boolean): Observable<Partner> {
      const index = data.findIndex((item) => item.id === id);
      if (index >= 0) data[index] = { ...data[index], active };
      return of(partner({ id, active }));
    }

    TestBed.configureTestingModule({
      imports: [
        Contacts,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: PartnerService,
          useValue: {
            getPartners: list,
            getPartner: () => of(undefined),
            createPartner: () => of(data[0]),
            updatePartner: () => of(data[0]),
            archivePartner: (id: string) => update(id, false),
            restorePartner: (id: string) => update(id, true),
          },
        },
      ],
    });

    // The tests run as the company administrator (full action set).
    TestBed.inject(AuthService).refreshUser({
      id: 1,
      name: 'Admin Demo',
      email: 'admin@tenant.com',
      role: 'admin-entreprise',
    });

    return TestBed.createComponent(Contacts);
  }

  it('renders one row per active contact', async () => {
    const fixture = setup();
    await render(fixture);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Acme Corp');
  });

  it('shows the loading state while the request is pending', async () => {
    const fixture = setup({ list: () => NEVER });
    await render(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelector('.spinner')).toBeTruthy();
  });

  it('shows the error state when the request fails', async () => {
    const fixture = setup({
      list: (query) =>
        query.kind === 'company' ? of(pageOf([])) : throwError(() => new Error('boom')),
    });
    await render(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Contacts could not be loaded');
  });

  it('shows the empty state when there is no contact', async () => {
    const fixture = setup({ data: [] });
    await render(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No contacts yet');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')).toBeNull();
  });

  it('hides the contact from the list after it is archived', async () => {
    const data = [...ACTIVE_PARTNERS];
    const fixture = setup({ data, list: (query) => listPartners(data, query) });
    await render(fixture);

    const archiveButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'tbody tr .col-actions button',
    );
    archiveButton?.click();
    await render(fixture);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Global Ltd');
  });
});
