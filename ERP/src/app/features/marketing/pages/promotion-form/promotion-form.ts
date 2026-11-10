import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { todayIso } from '../../../../shared/utils/money';
import {
  CustomerSegment,
  DiscountType,
  MarketingCampaign,
  MarketingPromotionInput,
} from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-promotion-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './promotion-form.html',
  styleUrl: './promotion-form.css',
})
export class PromotionForm {
  private readonly api = inject(MarketingApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly promotionId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.promotionId;

  campaigns = signal<MarketingCampaign[]>([]);
  segments = signal<CustomerSegment[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notFound = signal(false);
  saving = signal(false);
  submitted = signal(false);
  saveFailed = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    campaignId: [''],
    segmentId: ['', Validators.required],
    discountType: ['percentage' as DiscountType, Validators.required],
    discountValue: [10, [Validators.required, Validators.min(0.01)]],
    minOrderAmount: [0, [Validators.required, Validators.min(0)]],
    startDate: [todayIso(), Validators.required],
    endDate: [todayIso(), Validators.required],
    active: [true],
  });

  constructor() {
    this.loadOptions();
  }

  loadOptions(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      campaigns: this.api.getCampaigns(),
      segments: this.api.getSegments(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ campaigns, segments }) => {
          this.campaigns.set(campaigns);
          this.segments.set(segments);
          if (this.promotionId) {
            this.loadPromotion();
          } else {
            this.loading.set(false);
          }
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  loadPromotion(): void {
    if (!this.promotionId) return;

    this.api
      .getPromotion(this.promotionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotion) => {
          this.form.patchValue({
            name: promotion.name,
            description: promotion.description ?? '',
            campaignId: promotion.campaignId ?? '',
            segmentId: promotion.segmentId,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            minOrderAmount: promotion.minOrderAmount,
            startDate: promotion.startDate,
            endDate: promotion.endDate,
            active: promotion.active,
          });
          this.loading.set(false);
        },
        error: (error) => {
          if (error.status === 404) {
            this.notFound.set(true);
          } else {
            this.loadFailed.set(true);
          }
          this.loading.set(false);
        },
      });
  }

  dateProblem(): boolean {
    const { startDate, endDate } = this.form.getRawValue();
    return !!startDate && !!endDate && endDate < startDate;
  }

  percentageProblem(): boolean {
    const { discountType, discountValue } = this.form.getRawValue();
    return discountType === 'percentage' && discountValue > 100;
  }

  isInvalid(
    name:
      | 'name'
      | 'segmentId'
      | 'discountValue'
      | 'minOrderAmount'
      | 'startDate'
      | 'endDate',
  ): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  submit(): void {
    this.submitted.set(true);
    this.saveFailed.set(false);

    if (this.form.invalid || this.dateProblem() || this.percentageProblem()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const input: MarketingPromotionInput = {
      name: value.name.trim(),
      description: value.description.trim(),
      campaignId: value.campaignId || null,
      segmentId: value.segmentId,
      discountType: value.discountType,
      discountValue: value.discountValue,
      minOrderAmount: value.minOrderAmount,
      startDate: value.startDate,
      endDate: value.endDate,
      active: value.active,
    };

    const request = this.promotionId
      ? this.api.updatePromotion(this.promotionId, input)
      : this.api.createPromotion(input);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate(['/marketing/promotions']),
      error: () => {
        this.saveFailed.set(true);
        this.saving.set(false);
      },
    });
  }
}
