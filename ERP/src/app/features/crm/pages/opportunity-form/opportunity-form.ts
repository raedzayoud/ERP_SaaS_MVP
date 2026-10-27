import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OpportunityService } from '../../services/opportunity.service';
import { PartnerService } from '../../services/partner.service';
import { OpportunityInput, Opportunity } from '../../models/opportunity';
import { PIPELINE_STAGES, PipelineStage } from '../../models/pipeline';

type CheckedControl = 'name' | 'amount' | 'customerId';

@Component({
  selector: 'app-opportunity-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './opportunity-form.html',
})
export class OpportunityForm {
  private readonly service = inject(OpportunityService);
  private readonly partners = inject(PartnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly opportunityId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.opportunityId !== null;
  readonly stages = PIPELINE_STAGES;

  customers = signal<{ id: string; name: string }[]>([]);
  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitted = signal(false);
  errorKey = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    customerId: ['', Validators.required],
    stage: ['qualification' as PipelineStage, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    expectedCloseDate: ['', Validators.required],
    notes: [''],
  });

  constructor() {
    this.loadCustomers();

    if (this.opportunityId) {
      this.loadOpportunity(this.opportunityId);
    }
  }

  isInvalid(controlName: CheckedControl): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(controlName: CheckedControl, error: string): boolean {
    return this.isInvalid(controlName) && this.form.controls[controlName].hasError(error);
  }

  stageKey(stage: string): string {
    return `crm.pipeline.stage.${stage}`;
  }

  submit(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: OpportunityInput = {
      id: this.opportunityId,
      name: raw.name.trim(),
      customerId: raw.customerId,
      stage: raw.stage,
      amount: raw.amount,
      expectedCloseDate: raw.expectedCloseDate,
      notes: raw.notes.trim(),
    };

    this.saving.set(true);

    this.service
      .saveDraft(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/opportunities']);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorKey.set(
            error instanceof Error && 'code' in error
              ? `crm.errors.${(error as { code: string }).code}`
              : 'crm.opportunities.saveError',
          );
        },
      });
  }

  private loadCustomers(): void {
    this.partners
      .getPartners({ page: 0, size: 500, active: true, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((page) => {
        this.customers.set(
          page.items.filter((partner) => partner.isCustomer).map((p) => ({ id: p.id, name: p.name })),
        );
      });
  }

  private loadOpportunity(id: string): void {
    this.loading.set(true);

    this.service
      .getOpportunity(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opportunity: Opportunity | undefined) => {
          if (opportunity) {
            this.form.setValue({
              name: opportunity.name,
              customerId: opportunity.customerId,
              stage: opportunity.stage as PipelineStage,
              amount: opportunity.amount,
              expectedCloseDate: opportunity.expectedCloseDate,
              notes: opportunity.notes,
            });
          } else {
            this.loadFailed.set(true);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }
}
