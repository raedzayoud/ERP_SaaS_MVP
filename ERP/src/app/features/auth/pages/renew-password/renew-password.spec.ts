import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { withFreshStorage } from '../../../../core/services/storage-test-helper';
import { RenewPassword } from './renew-password';

const EN = {
  rbac: {
    renewal: {
      title: 'Choose a new password',
      newPassword: 'New password',
      confirm: 'Confirm password',
      mismatch: 'The two passwords do not match.',
      minLength: 'The password must contain at least 6 characters.',
      submit: 'Save and continue',
    },
  },
};

describe('RenewPassword', () => {
  let fixture: ComponentFixture<RenewPassword>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    withFreshStorage();

    TestBed.configureTestingModule({
      imports: [
        RenewPassword,
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

    TestBed.inject(AuthService).refreshUser({
      id: 1,
      name: 'Amira',
      email: 'admin@demo.com',
      role: 'admin-entreprise',
      mustRenewPassword: true,
    });

    TestBed.inject(TenantService).ensureDemoTenant();
    fixture = TestBed.createComponent(RenewPassword);
  });

  function submit(first: string, second: string): void {
    fixture.componentInstance.newPassword.set(first);
    fixture.componentInstance.confirm.set(second);
    fixture.componentInstance.onSubmit(new Event('submit'));
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the forced renewal form with the pending user', async () => {
    await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Choose a new password',
    );
  });

  it('refuses mismatched or short passwords', async () => {
    submit('a', 'a');
    await render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The password must contain at least 6 characters.',
    );

    submit('strong-6', 'other-6');
    await render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The two passwords do not match.',
    );
  });

  it('clears the renewal flag and goes back home', () => {
    submit('strong-6', 'strong-6');

    expect(TestBed.inject(AuthService).currentUser()?.mustRenewPassword).toBeFalsy();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
