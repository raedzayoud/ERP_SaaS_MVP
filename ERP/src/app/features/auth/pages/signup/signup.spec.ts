import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import type { ErpApp } from '../../../../core/data/apps';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { PlatformService } from '../../../admin/services/platform.service';
import { SignupStateService } from '../../services/signup-state.service';

const app = (
  id: string,
  dependencies: string[] = [],
): ErpApp => ({ id, label: id, icon: '', description: '', category: '', dependencies });

describe('SignupStateService app selection', () => {
  let state: SignupStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: TenantService, useValue: { isSubdomainAvailable: () => true } },
        { provide: PlatformService, useValue: { createSignupRequest: () => ({ subscribe: () => {} }) } },
        {
          provide: TranslocoService,
          useValue: { translate: (key: string) => key } as unknown as TranslocoService,
        },
      ],
    });

    state = TestBed.inject(SignupStateService);
  });

  it('starts with a clean notice and only the dashboard selected', () => {
    expect(state.depNotice()).toBe('');
    expect(state.selectedApps()).toEqual(['dashboard']);
    expect(state.step()).toBe(1);
  });

  it('never unselects the dashboard', () => {
    const before = [...state.selectedApps()];

    state.toggleApp(app('dashboard'));

    expect(state.selectedApps()).toEqual(before);
  });

  it('auto-adds the dependencies of a selected app', () => {
    state.toggleApp(app('invoicing'));

    expect(state.isAppSelected('invoices')).toBe(true);
    expect(state.depNotice()).toContain('signup.appStep.addedBecause');
  });

  it('blocks the deselection of an app required by other selected apps', () => {
    state.toggleApp(app('sales')); // auto-adds contacts + products
    const before = state.selectedApps().join(',');

    state.toggleApp(app('contacts')); // direct dependent: sales

    expect(state.selectedApps().join(',')).toBe(before);
    expect(state.depNotice()).toContain('signup.appStep.blockedBy');
  });

  it('allows the deselection of an app nobody depends on and clears the notice', () => {
    state.toggleApp(app('stock')); // auto-adds products
    state.toggleApp(app('stock')); // no selected app depends on stock

    expect(state.isAppSelected('stock')).toBe(false);
    expect(state.depNotice()).toBe('');
  });

  it('provisions Invoicing Settings with Invoices and removes them together', () => {
    state.toggleApp(app('invoices'));

    expect(state.isAppSelected('invoicing')).toBe(true);

    // Deselect works: Invoicing Settings is automatic, never a blocker.
    state.toggleApp(app('invoices'));

    expect(state.isAppSelected('invoices')).toBe(false);
    expect(state.isAppSelected('invoicing')).toBe(false);
    expect(state.depNotice()).toBe('');
  });

  it('selects the whole suite with the master checkbox', () => {
    const finance = state.appGroups.find((g) => g.id === 'finance')!;

    state.toggleSuite(finance); // none -> all

    expect(state.isAppSelected('accounting')).toBe(true);
    expect(state.isAppSelected('reports')).toBe(true);
    expect(state.isAppSelected('invoices')).toBe(true); // dependency
    expect(state.suiteState(finance)).toBe('all');
    expect(state.depNotice()).toContain('signup.appStep.suiteAdded');
  });

  it('keeps apps that other suites still need when clearing a suite', () => {
    state.toggleApp(app('accounting')); // adds invoices, purchases, contacts, products
    state.toggleApp(app('payments')); // invoices already selected -> adds payments
    state.toggleApp(app('sales')); // deps already selected
    const sales = state.appGroups.find((g) => g.id === 'sales')!;
    expect(state.suiteState(sales)).toBe('all');

    state.toggleSuite(sales); // all -> try to clear the whole box

    expect(state.isAppSelected('sales')).toBe(false);
    expect(state.isAppSelected('payments')).toBe(false);
    expect(state.isAppSelected('products')).toBe(true); // purchases need it
    expect(state.isAppSelected('invoices')).toBe(true); // accounting needs it
    expect(state.suiteState(sales)).toBe('some');
    expect(state.depNotice()).toContain('signup.appStep.blockedBy');
  });

  it('fills the remaining apps of a suite when its state is "some"', () => {
    state.toggleApp(app('payments')); // adds invoices, contacts, products
    const sales = state.appGroups.find((g) => g.id === 'sales')!;
    expect(state.suiteState(sales)).toBe('some');

    state.toggleSuite(sales); // some -> select everything inside the box

    expect(state.isAppSelected('sales')).toBe(true);
    expect(state.suiteState(sales)).toBe('all');
    expect(state.depNotice()).toContain('signup.appStep.suiteAdded');
  });

  it('resolves valid suites from the route parameter and rejects the rest', () => {
    expect(state.resolveSuite('finance')?.id).toBe('finance');
    expect(state.resolveSuite('sales')?.id).toBe('sales');
    expect(state.resolveSuite('general')).toBeUndefined(); // hub-only
    expect(state.resolveSuite('hackers')).toBeUndefined();
    expect(state.resolveSuite(undefined)).toBeUndefined(); // /signup hub
  });
});

describe('SignupStateService KYC documents', () => {
  let state: SignupStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: TenantService, useValue: { isSubdomainAvailable: () => true } },
        { provide: PlatformService, useValue: { createSignupRequest: () => ({ subscribe: () => {} }) } },
        {
          provide: TranslocoService,
          useValue: { translate: (key: string) => key } as unknown as TranslocoService,
        },
      ],
    });

    state = TestBed.inject(SignupStateService);
  });

  it('blocks the flow until the three KYC documents are provided', () => {
    state.step.set(3);
    state.next();

    expect(state.step()).toBe(3);
    expect(state.error()).toContain('signup.docStep.errors.missing');
    expect(state.docsComplete()).toBe(false);

    state.uploadedDocs.set({
      idCard: { fileName: 'id.png', sizeKb: 80, dataUrl: 'data:image/png;base64,x' },
      tradeRegister: { fileName: 'register.pdf', sizeKb: 400 },
      taxRegistration: { fileName: 'tax.pdf', sizeKb: 300 },
    });

    expect(state.docsComplete()).toBe(true);

    state.next(); // request the verification code
    state.cleanupTimers();

    expect(state.step()).toBe(4);
    expect(state.error()).toBe('');
  });

  it('rejects oversized KYC files instead of storing them', () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'huge.pdf', {
      type: 'application/pdf',
    });
    const input = { files: [big], value: '' };
    state.onDocPick('idCard', { target: input } as unknown as Event);

    expect(state.docError()).toContain('signup.docStep.errors.tooLarge');
    expect(state.uploadedDocs()['idCard']).toBeUndefined();
    expect(state.docsComplete()).toBe(false);
  });

  it('accepts a PDF below the size limit and keeps only its name', () => {
    const pdf = new File([new Uint8Array(120 * 1024)], 'register.pdf', {
      type: 'application/pdf',
    });
    const input = { files: [pdf], value: '' };
    state.onDocPick('tradeRegister', { target: input } as unknown as Event);

    const stored = state.uploadedDocs()['tradeRegister'];
    expect(state.docError()).toBe('');
    expect(stored?.fileName).toBe('register.pdf');
    expect(stored?.sizeKb).toBe(120);
    expect(stored?.dataUrl).toBeUndefined();
  });
});
