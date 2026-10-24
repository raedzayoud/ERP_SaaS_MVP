import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Landing } from './landing';
import { AuthService } from '../../../../core/services/auth.service';

const EN = {
  landing: {
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      login: 'Sign in',
      signup: 'Sign up',
      dashboard: 'My dashboard',
    },
    hero: {
      title: 'The ERP that runs your whole business',
      subtitle: 'CRM, invoicing, purchases, stock, accounting and AI.',
      ctaPrimary: 'Start for free',
      ctaSecondary: 'See pricing',
      pill: 'Cloud multi-company ERP',
      note: 'No credit card required',
      stats: {
        modules: '10 modules included',
        plans: '3 plans',
        multi: 'Multi-company',
        langs: 'FR / EN',
      },
    },
    features: { title: 'Everything you need', subtitle: 'All the modules of a complete ERP.' },
    modules: {
      dashboard: 'Dashboard',
      contacts: 'CRM & Contacts',
      products: 'Products',
      invoices: 'Invoicing',
      payments: 'Payments',
      purchases: 'Purchases',
      stock: 'Stock',
      accounting: 'Accounting',
      reports: 'Reports',
      ai: 'AI Assistant',
    },
    modulesDesc: {
      dashboard: 'Track revenue and key indicators.',
      contacts: 'Manage customers and suppliers.',
      products: 'Catalog, prices and stock levels.',
      invoices: 'Quotes, invoices and credit notes.',
      payments: 'Record and track incoming payments.',
      purchases: 'Purchase orders and goods receptions.',
      stock: 'Multi-warehouse inventory management.',
      accounting: 'Journals, chart of accounts and trial balance.',
      reports: 'Exportable business reports.',
      ai: 'Ask questions, get answers from your data.',
    },
    pricing: {
      title: 'Simple, transparent pricing',
      subtitle: 'Choose the plan that fits your company.',
      billingToggle: 'Billing period',
      monthly: 'Monthly',
      annual: 'Annual',
      popular: 'Popular',
      perMonth: '/month',
      perYear: '/year',
      choose: 'Choose plan',
      annualBadge: '2 months free',
    },
    cta: {
      title: 'Ready to get started?',
      subtitle: 'Create your workspace in a few minutes.',
      button: 'Create my account',
    },
    planFeatures: {
      starter: {
        0: 'Up to 3 users',
        1: '1 GB storage',
        2: 'CRM & Contacts',
        3: 'Product catalog',
        4: 'Invoicing & Payments',
        5: 'Email support',
      },
      business: {
        0: 'Up to 15 users',
        1: '10 GB storage',
        2: 'Everything in Starter',
        3: 'Purchases & Stock',
        4: 'Accounting & Reports',
        5: '100 AI queries/month',
        6: 'Priority support',
      },
      enterprise: {
        0: 'Unlimited users',
        1: '100 GB storage',
        2: 'Everything in Business',
        3: 'AI Assistant (RAG)',
        4: '1,000 AI queries/month',
        5: 'Advanced analytics',
        6: 'Dedicated support',
        7: 'Custom integrations',
      },
    },
    footer: { copy: 'ERP Cloud SaaS. All rights reserved.' },
  },
};

describe('Landing', () => {
  async function render(loggedIn = false): Promise<ComponentFixture<Landing>> {
    TestBed.configureTestingModule({
      imports: [
        Landing,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
      ],
    });

    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the three pricing plans with their monthly prices', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Starter');
    expect(text).toContain('Business');
    expect(text).toContain('Enterprise');
    expect(text).toContain('$29');
    expect(text).toContain('$79');
    expect(text).toContain('$199');
    expect(text).toContain('/month');
  });

  it('switches to annual prices when the annual toggle is clicked', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    const annualBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Annual',
    );
    annualBtn?.click();
    fixture.detectChanges();

    const text = el.textContent ?? '';
    expect(text).toContain('$278');
    expect(text).toContain('$758');
    expect(text).toContain('$1910');
    expect(text).toContain('/year');
  });

  it('shows login and signup links for anonymous visitors', async () => {
    const fixture = await render(false);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('a[routerlink="/login"]')).toBeTruthy();
    expect(el.querySelector('a[routerlink="/signup"]')).toBeTruthy();
    expect(el.querySelector('a[routerlink="/dashboard"]')).toBeNull();
  });

  it('shows a dashboard button for logged-in users instead of login and signup', async () => {
    const fixture = await render(true);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('a[routerlink="/dashboard"]')).toBeTruthy();
    expect(el.querySelector('a[routerlink="/login"]')).toBeNull();
  });

  it('shows a short description for each module', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Catalog, prices and stock levels.');
    expect(text).toContain('Multi-warehouse inventory management.');
    expect(text).toContain('Journals, chart of accounts and trial balance.');
  });
});
