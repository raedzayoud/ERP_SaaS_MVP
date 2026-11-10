import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { AuditService } from '../../../../core/services/audit.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/models/user';
import { LoginGeneric } from './login-generic';

const EN = {
  rbac: {
    login: {
      genericTitle: 'Sign in to your workspace',
      invalid: 'Invalid email or password.',
      activate: 'Your account was deactivated; contact your administrator.',
      suspended: 'This workspace is suspended.',
      trialEnded: 'Your free trial is over. Subscribe to continue using the ERP.',
      network: 'Unable to reach the server.',
      generic: 'Sign in failed. Please try again.',
    },
  },
  login: {
    credentials: {
      password: 'Password',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      missing: 'Please enter your email and password.',
    },
    noAccount: "Don't have an account?",
    createWorkspace: 'Create your workspace',
    footer: 'ERP Cloud SaaS',
  },
  forgot: { link: 'Forgot password?' },
};

const USER: User = {
  id: 'user-1',
  name: 'Amira Ben Salah',
  email: 'owner@acme-test.com',
  role: 'admin-entreprise',
};

describe('LoginGeneric', () => {
  let fixture: ComponentFixture<LoginGeneric>;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    login = vi.fn();

    TestBed.configureTestingModule({
      imports: [
        LoginGeneric,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login, homeRouteForCurrentUser: () => '/dashboard' } },
        { provide: AuditService, useValue: { log: vi.fn() } },
      ],
    });

    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginGeneric);
  });

  function submit(email: string, password: string): void {
    fixture.componentInstance.email.set(email);
    fixture.componentInstance.password.set(password);
    fixture.componentInstance.onSubmit(new Event('submit'));
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('signs in through the API and opens the role home page', async () => {
    login.mockReturnValue(of(USER));

    submit('owner@acme-test.com', 'secret');
    await render();

    expect(login).toHaveBeenCalledWith('owner@acme-test.com', 'secret');
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects users with a pending renewal to /renew-password', () => {
    login.mockReturnValue(of({ ...USER, mustRenewPassword: true }));

    submit('owner@acme-test.com', 'secret');

    expect(navigate).toHaveBeenCalledWith(['/renew-password']);
  });

  it('shows an invalid-credentials message after a 401', async () => {
    login.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }),
      ),
    );

    submit('owner@acme-test.com', 'wrong');
    await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Invalid email or password.',
    );
  });

  it('shows the suspension message after a 403 from a suspended tenant', async () => {
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { message: 'account suspended' },
          }),
      ),
    );

    submit('owner@acme-test.com', 'secret');
    await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This workspace is suspended.',
    );
  });

  it('shows the trial-ended message after a 403 from an exhausted trial', async () => {
    login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { message: 'trial limit reached; subscribe to continue' },
          }),
      ),
    );

    submit('owner@acme-test.com', 'secret');
    await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Your free trial is over. Subscribe to continue using the ERP.',
    );
  });

  it('requires both fields before calling the API', async () => {
    submit('', '');
    await render();

    expect(login).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Please enter your email and password.',
    );
  });
});
