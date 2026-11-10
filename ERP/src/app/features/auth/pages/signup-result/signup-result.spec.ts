import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SignupResultComponent } from './signup-result';

describe('SignupResultComponent', () => {
  function create(mode: string, trial = false): SignupResultComponent {
    TestBed.configureTestingModule({
      imports: [
        SignupResultComponent,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: { signup: { result: {} } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap(trial ? { trial: '1' } : {}),
            },
          },
        },
      ],
    });

    return TestBed.createComponent(SignupResultComponent).componentInstance;
  }

  it('shows the success mode by default', () => {
    expect(create('success').mode).toBe('success');
  });

  it('shows the trial success mode from the query string', () => {
    const component = create('success', true);

    expect(component.trial).toBe(true);
    expect(component.resultKey).toBe('trial');
  });

  it('shows the cancelled mode from the route data', () => {
    expect(create('cancelled').mode).toBe('cancelled');
  });

  it('falls back to success for an unknown mode', () => {
    expect(create('unknown').mode).toBe('success');
  });
});
