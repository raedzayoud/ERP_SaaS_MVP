import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { HrDashboard } from './hr-dashboard';
import { HrApiService } from '../../services/hr-api.service';

const EN = {
  hr: {
    dashboard: {
      title: 'HR dashboard',
      subtitle: 'A quick view of your people and leave requests.',
      totalEmployees: 'Employees',
      onLeave: 'On leave',
      pendingLeave: 'Pending leave',
      roles: 'Roles',
      employeesLink: 'Manage employees',
      leaveLink: 'Manage leave',
    },
    employees: { loadError: 'Employees could not be loaded' },
  },
  common: { loading: 'Loading…' },
};

describe('HrDashboard', () => {
  function setup(getDashboard: () => unknown): ComponentFixture<HrDashboard> {
    TestBed.configureTestingModule({
      imports: [
        HrDashboard,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: HrApiService,
          useValue: {
            getDashboard: () =>
              getDashboard() instanceof Error
                ? throwError(() => getDashboard())
                : of(getDashboard()),
          },
        },
      ],
    });

    return TestBed.createComponent(HrDashboard);
  }

  async function render(fixture: ComponentFixture<HrDashboard>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the figures given by the API', async () => {
    const fixture = setup(() => ({
      totalEmployees: 12,
      onLeave: 3,
      pendingLeave: 4,
      roles: 5,
    }));
    await render(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('12');
    expect(text).toContain('3');
    expect(text).toContain('4');
    expect(text).toContain('5');
  });

  it('shows the error state and stops loading when the API fails', async () => {
    const fixture = setup(() => new Error('boom'));
    await render(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Employees could not be loaded');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
