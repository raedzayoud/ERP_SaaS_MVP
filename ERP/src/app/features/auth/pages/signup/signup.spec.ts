import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import type { ErpApp } from '../../../../core/data/apps';
import { AuthApiService } from '../../../../core/services/auth-api.service';
import { SignupStateService } from '../../services/signup-state.service';

const app = (
  id: string,
  dependencies: string[] = [],
): ErpApp => ({ id, label: id, icon: '', description: '', category: '', dependencies });

function kycFile(name: string, type: string, size = 120 * 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('SignupStateService', () => {
  let state: SignupStateService;
  let translate: ReturnType<typeof vi.fn>;
  let api: {
    signupAvailability: ReturnType<typeof vi.fn>;
    sendSignupOtp: ReturnType<typeof vi.fn>;
    verifySignupOtp: ReturnType<typeof vi.fn>;
    signup: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      signupAvailability: vi.fn().mockReturnValue(of({ subdomainAvailable: true })),
      sendSignupOtp: vi.fn().mockReturnValue(
        of({ message: 'sent', expiresInMinutes: 15, resendAfterSeconds: 60 }),
      ),
      verifySignupOtp: vi.fn().mockReturnValue(
        of({ verificationToken: 'verified-token', expiresInMinutes: 15 }),
      ),
      signup: vi.fn().mockReturnValue(of({ message: 'created', checkoutUrl: null })),
    };

    translate = vi.fn((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: api },
        {
          provide: TranslocoService,
          useValue: { translate } as unknown as TranslocoService,
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
    state.toggleApp(app('sales'));
    const before = state.selectedApps().join(',');

    state.toggleApp(app('contacts'));

    expect(state.selectedApps().join(',')).toBe(before);
    expect(state.depNotice()).toContain('signup.appStep.blockedBy');
  });

  it('allows the deselection of an app nobody depends on and clears the notice', () => {
    state.toggleApp(app('stock'));
    state.toggleApp(app('stock'));

    expect(state.isAppSelected('stock')).toBe(false);
    expect(state.depNotice()).toBe('');
  });

  it('provisions Invoicing Settings with Invoices and removes them together', () => {
    state.toggleApp(app('invoices'));

    expect(state.isAppSelected('invoicing')).toBe(true);

    state.toggleApp(app('invoices'));

    expect(state.isAppSelected('invoices')).toBe(false);
    expect(state.isAppSelected('invoicing')).toBe(false);
    expect(state.depNotice()).toBe('');
  });

  it('selects the whole suite with the master checkbox', () => {
    const finance = state.appGroups.find((g) => g.id === 'finance')!;

    state.toggleSuite(finance);

    expect(state.isAppSelected('accounting')).toBe(true);
    expect(state.isAppSelected('reports')).toBe(true);
    expect(state.isAppSelected('invoices')).toBe(true);
    expect(state.suiteState(finance)).toBe('all');
    expect(state.depNotice()).toContain('signup.appStep.suiteAdded');
  });

  it('resolves valid suites from the route parameter and rejects the rest', () => {
    expect(state.resolveSuite('finance')?.id).toBe('finance');
    expect(state.resolveSuite('sales')?.id).toBe('sales');
    expect(state.resolveSuite('general')).toBeUndefined();
    expect(state.resolveSuite('hackers')).toBeUndefined();
    expect(state.resolveSuite(undefined)).toBeUndefined();
  });

  it('requires a password and a validated subdomain on the details step', () => {
    state.fullName.set('Acme Owner');
    state.companyName.set('Acme');
    state.email.set('owner@acme.com');
    state.password.set('12345');
    state.subdomain.set('acme');
    state.subdomainChecked.set(true);

    expect(state.formValid()).toBe(false);

    state.password.set('123456');
    expect(state.formValid()).toBe(true);
  });

  it('auto-sends the code when moving from details to verify', () => {
    vi.useFakeTimers();
    try {
      state.step.set(2);
      state.fullName.set('Acme Owner');
      state.companyName.set('Acme');
      state.email.set('owner@acme.com');
      state.password.set('secret123');
      state.subdomain.set('acme');
      state.subdomainChecked.set(true);

      state.next();

      expect(state.step()).toBe(3);
      expect(state.error()).toBe('');
      expect(api.sendSignupOtp).toHaveBeenCalledWith('owner@acme.com');
      expect(state.otpSent()).toBe(true);

      state.next();

      expect(state.step()).toBe(3);
      expect(state.error()).toContain('signup.verifyStep.errors.required');

      state.emailVerified.set(true);
      state.next();

      expect(state.step()).toBe(4);
      expect(state.error()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends and verifies the signup email code', () => {
    vi.useFakeTimers();
    try {
      state.email.set('Owner@Acme.com');

      state.sendOtp();

      expect(api.sendSignupOtp).toHaveBeenCalledWith('owner@acme.com');
      expect(state.otpSent()).toBe(true);
      expect(state.otpResendAfter()).toBe(60);

      state.onOtpCodeInput({ target: { value: '12a34 56' } } as unknown as Event);
      expect(state.otpCode()).toBe('123456');

      state.verifyOtp();

      expect(api.verifySignupOtp).toHaveBeenCalledWith('owner@acme.com', '123456');
      expect(state.emailVerified()).toBe(true);
      expect(state.verificationToken()).toBe('verified-token');
      expect(state.otpResendAfter()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the verification when the email address changes', () => {
    state.email.set('owner@acme.com');
    state.emailVerified.set(true);
    state.verificationToken.set('verified-token');
    state.otpSent.set(true);

    state.onFormInput('email', {
      target: { value: 'other@acme.com' },
    } as unknown as Event);

    expect(state.email()).toBe('other@acme.com');
    expect(state.emailVerified()).toBe(false);
    expect(state.verificationToken()).toBe('');
    expect(state.otpSent()).toBe(false);
  });

  it('checks subdomain availability after a short debounce', async () => {
    state.onSubdomainInput({ target: { value: 'Acme!' } } as unknown as Event);

    expect(state.subdomain()).toBe('acme');
    expect(state.subdomainChecking()).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(api.signupAvailability).toHaveBeenCalledWith('acme');
    expect(state.subdomainChecked()).toBe(true);
    expect(state.subdomainChecking()).toBe(false);
  });

  it('reports a failed availability check without blocking the form silently', async () => {
    api.signupAvailability.mockReturnValue(throwError(() => new Error('offline')));

    state.onSubdomainInput({ target: { value: 'acme' } } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(state.subdomainChecked()).toBeNull();
    expect(state.subdomainCheckFailed()).toBe(true);
    expect(state.formValid()).toBe(false);
  });

  it('blocks the flow until the four KYC files and the tax number are provided', () => {
    state.step.set(4);
    state.next();

    expect(state.step()).toBe(4);
    expect(state.error()).toContain('signup.docStep.errors.missing');
    expect(state.docsComplete()).toBe(false);

    state.uploadedDocs.set({
      idCardRecto: kycFile('id-recto.png', 'image/png'),
      idCardVerso: kycFile('id-verso.png', 'image/png'),
      tradeRegister: kycFile('register.pdf', 'application/pdf'),
      taxRegistration: kycFile('tax.pdf', 'application/pdf'),
    });
    expect(state.docsComplete()).toBe(true);

    state.next();
    expect(state.step()).toBe(4);
    expect(state.error()).toContain('signup.docStep.errors.taxIdMissing');
    expect(state.documentsStepComplete()).toBe(false);

    state.taxId.set('1234567/A/M/000');
    expect(state.documentsStepComplete()).toBe(true);

    state.next();

    expect(state.step()).toBe(5);
    expect(state.error()).toBe('');
  });

  it('rejects oversized and unsupported KYC files', () => {
    const big = kycFile('huge.pdf', 'application/pdf', 3 * 1024 * 1024);
    const bigInput = { files: [big], value: '' };
    state.onDocPick('idCardRecto', { target: bigInput } as unknown as Event);

    expect(state.docError()).toContain('signup.docStep.errors.tooLarge');
    expect(state.uploadedDocs()['idCardRecto']).toBeUndefined();

    const wrongType = kycFile('scan.txt', 'text/plain');
    const wrongInput = { files: [wrongType], value: '' };
    state.onDocPick('idCardRecto', { target: wrongInput } as unknown as Event);

    expect(state.docError()).toContain('signup.docStep.errors.type');
    expect(state.uploadedDocs()['idCardRecto']).toBeUndefined();
  });

  it('keeps the real File object for the API request', () => {
    const pdf = kycFile('register.pdf', 'application/pdf');
    const input = { files: [pdf], value: '' };
    state.onDocPick('tradeRegister', { target: input } as unknown as Event);

    expect(state.docError()).toBe('');
    expect(state.uploadedDocs()['tradeRegister']).toBe(pdf);
    expect(state.docSizeKb(pdf)).toBe(120);
  });

  it('submits the real payload and maps an existing email to a friendly error', () => {
    fillValidWizard();
    api.signup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'email already in use' },
          }),
      ),
    );

    state.submit();

    expect(api.signup).toHaveBeenCalled();
    const [payload, documents] = api.signup.mock.calls.at(-1)!;
    expect(payload).toEqual(
      expect.objectContaining({
        fullName: 'Acme Owner',
        companyName: 'Acme',
        subdomain: 'acme',
        email: 'owner@acme.com',
        password: 'secret123',
        taxId: '1234567/A/M/000',
        planId: 'starter',
        billingInterval: 'MONTHLY',
        verificationToken: 'verified-token',
      }),
    );
    expect(documents.idCardRecto).toBeInstanceOf(File);
    expect(translate).toHaveBeenCalledWith('signup.errors.emailUsed');
    expect(state.error()).toBe('signup.errors.emailUsed');
    expect(state.submitting()).toBe(false);
  });

  it('navigates to the trial success page when signup returns no checkout URL', () => {
    fillValidWizard();
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockImplementation(() => Promise.resolve(true));

    state.submit();

    expect(navigate).toHaveBeenCalledWith(['/signup/success'], {
      queryParams: { trial: 1 },
    });
    expect(state.password()).toBe('');
  });

  it('switches the price when the annual interval is selected', () => {
    state.setBillingInterval('ANNUAL');

    expect(state.billingInterval()).toBe('ANNUAL');
    expect(state.selectedPrice()).toBe(state.selectedPlan().priceAnnual);
  });

  function fillValidWizard(): void {
    state.step.set(5);
    state.fullName.set('Acme Owner');
    state.companyName.set('Acme');
    state.subdomain.set('acme');
    state.email.set('owner@acme.com');
    state.password.set('secret123');
    state.subdomainChecked.set(true);
    state.emailVerified.set(true);
    state.verificationToken.set('verified-token');
    state.taxId.set('1234567/A/M/000');
    state.uploadedDocs.set({
      idCardRecto: kycFile('id-recto.png', 'image/png'),
      idCardVerso: kycFile('id-verso.png', 'image/png'),
      tradeRegister: kycFile('register.pdf', 'application/pdf'),
      taxRegistration: kycFile('tax.pdf', 'application/pdf'),
    });
  }
});
