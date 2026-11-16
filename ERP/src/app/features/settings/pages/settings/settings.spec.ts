import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings';
import { SettingsApiService } from '../../services/settings-api.service';
import { ActivityApiService } from '../../services/activity-api.service';
import { BillingApiService } from '../../../../core/services/billing-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';

const EN = {
  settings: {
    modules: {
      title: 'Modules',
      hint: 'Add a module to your workspace.',
      active: 'Active',
      requires: 'Requires',
      perMonth: 'month',
      total: 'Monthly total',
      pay: 'Pay and unlock',
      none: 'No module is available for sale right now.',
      notConfigured: 'Not available for sale yet',
    },
    messages: {
      modulesFailed: 'The module catalog could not be loaded.',
      moduleAlreadyActive: 'This module is already part of your workspace.',
      moduleAlreadyPaid: 'This module is already part of your subscription.',
      moduleUnknown: 'This module is not available.',
      paymentFailed: 'The payment could not be started. Please try again.',
      noSubscription: 'Your workspace has no subscription yet. Subscribe first.',
      modulesPurchaseFailed: 'The purchase could not be prepared. Please try again.',
    },
  },
  apps: {
    items: {
      stock: { label: 'Stock' },
      hr: { label: 'HR' },
      purchases: { label: 'Purchases' },
      contacts: { label: 'Contacts' },
      products: { label: 'Products' },
    },
  },
  common: { loading: 'Loading…', retry: 'Try again' },
};

describe('SettingsComponent modules tab', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let addModules: ReturnType<typeof vi.fn>;

  function setup(addModulesError?: unknown, tab?: string): ComponentFixture<SettingsComponent> {
    addModules = vi.fn().mockReturnValue(
      addModulesError
        ? throwError(() => addModulesError)
        : of({ url: 'https://stripe.test/invoice', totalMonthly: 20, modules: ['stock'] }),
    );
    const tenant = signal<{ enabledModules: string[] } | null>({ enabledModules: ['stock'] });

    TestBed.configureTestingModule({
      imports: [
        SettingsComponent,
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
            snapshot: { queryParamMap: convertToParamMap(tab ? { tab } : {}) },
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
            // The module shows up only once the purchase went through.
            reloadAccount: () => {
              if (addModules.mock.calls.length > 0) {
                tenant.set({ enabledModules: ['stock', 'reports'] });
              }
              return of(null);
            },
          },
        },
        {
          provide: TenantService,
          useValue: {
            currentTenant: tenant,
            enabledModules: signal([]),
            isModuleEnabled: () => false,
            activeCurrency: () => 'USD',
            setFromAuthTenant: () => undefined,
          },
        },
        {
          provide: SettingsApiService,
          useValue: {
            getCompany: () => of(null),
            getUsers: () => of([]),
            getModules: () =>
              of({
                plan: 'starter',
                enabledModules: ['stock'],
                offers: [
                  { id: 'stock', priceMonthly: 20, currency: 'USD', dependencies: ['products'], saleable: false },
                  { id: 'hr', priceMonthly: 25, currency: 'USD', dependencies: [], saleable: false },
                  {
                    id: 'purchases',
                    priceMonthly: 15,
                    currency: 'USD',
                    dependencies: ['contacts', 'products'],
                    saleable: true,
                  },
                ],
              }),
            addModules,
          },
        },
        { provide: ActivityApiService, useValue: { recent: () => of([]) } },
        {
          provide: BillingApiService,
          useValue: {
            subscription: () => of(null),
            refresh: () => of(null),
            portal: () => of({ url: '' }),
            checkout: () => of({ url: '' }),
          },
        },
      ],
    });

    return TestBed.createComponent(SettingsComponent);
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lists the module offers with their price', async () => {
    fixture = setup();
    await render();

    fixture.componentInstance.setTab('modules');
    await render();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('HR');
    expect(text).toContain('$25');
  });

  it('does not let the customer pick a module without a Stripe price', async () => {
    fixture = setup();
    await render();

    fixture.componentInstance.setTab('modules');
    await render();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.module-row');
    const checkboxes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      '.module-row input[type="checkbox"]',
    );

    // Stock is active: no badge, not clickable.
    expect(rows[0].textContent).toContain('Active');
    expect(rows[0].textContent).not.toContain('Not available for sale yet');
    expect(checkboxes[0].disabled).toBe(true);

    // HR has no Stripe price: listed but not clickable.
    expect(checkboxes[1].disabled).toBe(true);
    expect(rows[1].textContent).toContain('Not available for sale yet');

    // Purchases can be bought.
    expect(checkboxes[2].disabled).toBe(false);
  });

  it('separates the required modules with a comma', async () => {
    fixture = setup();
    await render();

    fixture.componentInstance.setTab('modules');
    await render();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.module-row');
    expect(rows[2].textContent).toContain('Contacts, Products');
  });

  it('charges the selected modules', async () => {
    fixture = setup();
    await render();

    fixture.componentInstance.setTab('modules');
    await render();

    fixture.componentInstance.toggleModule('stock');
    fixture.detectChanges();

    expect(fixture.componentInstance.moduleTotal()).toBe(20);

    const openStripeTab = vi
      .spyOn(fixture.componentInstance, 'openStripeTab')
      .mockImplementation(() => undefined);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.buyModules();

    expect(addModules).toHaveBeenCalledWith(['stock']);
    expect(openStripeTab).toHaveBeenCalledWith('https://stripe.test/invoice');
  });

  it('opens the modules tab when the URL asks for it', async () => {
    fixture = setup(undefined, 'modules');
    await render();

    expect(fixture.componentInstance.activeTab()).toBe('modules');
  });

  it('goes to the dashboard once the payment is confirmed', async () => {
    fixture = setup();
    await render();

    fixture.componentInstance.setTab('modules');
    await render();
    fixture.componentInstance.toggleModule('stock');

    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    vi.spyOn(fixture.componentInstance, 'openStripeTab').mockImplementation(() => undefined);

    fixture.componentInstance.buyModules();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/dashboard'], {
      queryParams: { payment: 'success', modules: 'reports' },
    });
  });

  it('shows the API error code instead of the catalog message', async () => {
    fixture = setup({
      error: { code: 'paymentFailed', message: 'payment provider error' },
    });
    await render();

    fixture.componentInstance.setTab('modules');
    await render();

    fixture.componentInstance.toggleModule('stock');
    vi.spyOn(fixture.componentInstance, 'openStripeTab').mockImplementation(() => undefined);
    fixture.componentInstance.buyModules();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('The payment could not be started.');
    expect(text).not.toContain('The module catalog could not be loaded.');
  });
});
