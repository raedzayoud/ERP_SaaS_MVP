import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { AuditService } from '../../../../core/services/audit.service';
import { withFreshStorage } from '../../../../core/services/storage-test-helper';
import { LoginGeneric } from './login-generic';

const EN = {
  rbac: {
    login: {
      genericTitle: 'Sign in to your workspace',
      email: 'Email',
      invalid: 'This email does not belong to any active member.',
      activate: 'Your account was deactivated; contact your administrator.',
    },
  },
  login: { credentials: { password: 'Password' } },
};

describe('LoginGeneric', () => {
  let fixture: ComponentFixture<LoginGeneric>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    withFreshStorage();

    TestBed.configureTestingModule({
      imports: [
        LoginGeneric,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [provideRouter([])],
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

  it('shows an error for an unknown email', async () => {
    submit('ghost@unknown.io', 'demo');
    await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This email does not belong to any active member.',
    );
  });

  it('sends an admin demo account to its home page', () => {
    submit('admin@demo.com', 'demo');

    expect(TestBed.inject(AuthService).currentUser()?.email).toBe('admin@demo.com');
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects members with a pending renewal to /renew-password', () => {
    TestBed.inject(TenantService).ensureDemoTenant();
    TestBed.inject(TenantService).setUserMustRenew(1, true);

    submit('admin@demo.com', 'demo');

    expect(navigate).toHaveBeenCalledWith(['/renew-password']);
    expect(TestBed.inject(AuditService).recent(10)[0].action).toBe('login');
  });
});
