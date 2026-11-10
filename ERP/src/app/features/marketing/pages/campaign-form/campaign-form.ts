import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../../../core/services/tenant.service';
import { todayIso } from '../../../../shared/utils/money';
import { CampaignChannel, MarketingCampaignInput } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-campaign-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './campaign-form.html',
  styleUrl: './campaign-form.css',
})
export class CampaignForm {
  private readonly api = inject(MarketingApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tenant = inject(TenantService);

  readonly campaignId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.campaignId;
  readonly currency = this.tenant.activeCurrency();

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  notFound = signal(false);
  saving = signal(false);
  submitted = signal(false);
  saveFailed = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    channel: ['email' as CampaignChannel, Validators.required],
    startDate: [todayIso(), Validators.required],
    endDate: [todayIso(), Validators.required],
    budget: [0, [Validators.required, Validators.min(0)]],
    active: [true],
  });

  constructor() {
    if (this.campaignId) {
      this.load();
    }
  }

  load(): void {
    if (!this.campaignId) return;

    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);

    this.api
      .getCampaign(this.campaignId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (campaign) => {
          this.form.patchValue({
            name: campaign.name,
            description: campaign.description ?? '',
            channel: campaign.channel,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            budget: campaign.budget,
            active: campaign.active,
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

  isInvalid(name: 'name' | 'startDate' | 'endDate' | 'budget'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  submit(): void {
    this.submitted.set(true);
    this.saveFailed.set(false);

    if (this.form.invalid || this.dateProblem()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const input: MarketingCampaignInput = {
      name: value.name.trim(),
      description: value.description.trim(),
      channel: value.channel,
      startDate: value.startDate,
      endDate: value.endDate,
      budget: value.budget,
      currency: this.currency,
      active: value.active,
    };

    const request = this.campaignId
      ? this.api.updateCampaign(this.campaignId, input)
      : this.api.createCampaign(input);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate(['/marketing/campaigns']),
      error: () => {
        this.saveFailed.set(true);
        this.saving.set(false);
      },
    });
  }
}
