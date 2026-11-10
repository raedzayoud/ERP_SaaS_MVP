import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TenantService } from '../../../../core/services/tenant.service';
import { formatMoney, todayIso } from '../../../../shared/utils/money';
import { Partner } from '../../../crm/models/partner';
import { PartnerService } from '../../../crm/services/partner.service';
import {
  MarketingPromotion,
  PromotionEvaluationResponse,
} from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-promotion-evaluator',
  imports: [ReactiveFormsModule, TranslocoDirective],
  templateUrl: './promotion-evaluator.html',
  styleUrl: './promotion-evaluator.css',
})
export class PromotionEvaluator {
  private readonly api = inject(MarketingApiService);
  private readonly partners = inject(PartnerService);
  private readonly tenant = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = this.tenant.activeCurrency();

  customers = signal<Partner[]>([]);
  customersLoading = signal(true);
  customersFailed = signal(false);
  eligible = signal<MarketingPromotion[]>([]);
  eligibleLoading = signal(false);
  result = signal<PromotionEvaluationResponse | null>(null);
  evaluating = signal(false);
  submitted = signal(false);
  evaluateFailed = signal(false);

  form = this.fb.nonNullable.group({
    customerId: ['', Validators.required],
    subtotal: [0, [Validators.required, Validators.min(0)]],
    date: [todayIso()],
  });

  constructor() {
    this.loadCustomers();

    this.form.controls.customerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.result.set(null);
        this.loadEligible();
      });

    this.form.controls.date.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadEligible());
  }

  loadCustomers(): void {
    this.customersLoading.set(true);
    this.customersFailed.set(false);

    this.partners
      .getPartners({ page: 0, size: 100, active: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.customers.set(page.items.filter((partner) => partner.isCustomer));
          this.customersLoading.set(false);
        },
        error: () => {
          this.customersFailed.set(true);
          this.customersLoading.set(false);
        },
      });
  }

  loadEligible(): void {
    const { customerId, date } = this.form.getRawValue();
    if (!customerId) {
      this.eligible.set([]);
      return;
    }

    this.eligibleLoading.set(true);
    this.api
      .getEligiblePromotions(customerId, date || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.eligible.set(promotions);
          this.eligibleLoading.set(false);
        },
        error: () => {
          this.eligible.set([]);
          this.eligibleLoading.set(false);
        },
      });
  }

  evaluate(): void {
    this.submitted.set(true);
    this.evaluateFailed.set(false);
    this.result.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.evaluating.set(true);
    const value = this.form.getRawValue();

    this.api
      .evaluatePromotion({
        customerId: value.customerId,
        subtotal: value.subtotal,
        currency: this.currency,
        date: value.date || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.evaluating.set(false);
        },
        error: () => {
          this.evaluateFailed.set(true);
          this.evaluating.set(false);
        },
      });
  }

  money(value: number): string {
    return formatMoney(value, this.currency, this.transloco.getActiveLang());
  }

  discountLabel(promotion: MarketingPromotion): string {
    if (promotion.discountType === 'percentage') {
      return `${promotion.discountValue}%`;
    }
    return this.money(promotion.discountValue);
  }

  isInvalid(name: 'customerId' | 'subtotal'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }
}
