import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { getAllPlans } from '../../../../core/data/plans';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  private readonly auth = inject(AuthService);

  readonly plans = getAllPlans();
  readonly loggedIn = this.auth.isLoggedIn();
  readonly billingCycle = signal<'monthly' | 'annual'>('monthly');

  readonly modules = [
    { icon: '📊', key: 'dashboard' },
    { icon: '👥', key: 'contacts' },
    { icon: '📦', key: 'products' },
    { icon: '🧾', key: 'invoices' },
    { icon: '💳', key: 'payments' },
    { icon: '🛒', key: 'purchases' },
    { icon: '🏬', key: 'stock' },
    { icon: '📒', key: 'accounting' },
    { icon: '📈', key: 'reports' },
    { icon: '🤖', key: 'ai' },
  ];

  price(plan: { priceMonthly: number; priceAnnual: number }): number {
    return this.billingCycle() === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
  }

  setBillingCycle(cycle: 'monthly' | 'annual'): void {
    this.billingCycle.set(cycle);
  }
}
