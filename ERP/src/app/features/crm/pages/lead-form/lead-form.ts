import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeadService } from '../../services/lead.service';
import { LEAD_SOURCES, LeadInput, LeadSource, LeadStatus } from '../../models/lead';

type CheckedControl = 'name' | 'email';

@Component({
  selector: 'app-lead-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './lead-form.html',
})
export class LeadForm {
  private readonly service = inject(LeadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly leadId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.leadId !== null;
  readonly sources = LEAD_SOURCES;
  readonly emptySource: LeadSource = 'website';

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitted = signal(false);
  errorKey = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    company: [''],
    email: ['', Validators.email],
    phone: [''],
    source: ['website' as LeadSource, Validators.required],
    notes: [''],
  });

  constructor() {
    if (this.leadId) {
      this.loadLead(this.leadId);
    }
  }

  isInvalid(controlName: CheckedControl): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(controlName: CheckedControl, error: string): boolean {
    return this.isInvalid(controlName) && this.form.controls[controlName].hasError(error);
  }

  sourceKey(source: LeadSource): string {
    return `crm.leads.source.${source}`;
  }

  submit(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: LeadInput = {
      id: this.leadId,
      name: raw.name.trim(),
      company: raw.company.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      source: raw.source,
      status: this.isEdit ? this.currentStatus : 'new',
      notes: raw.notes.trim(),
    };

    this.saving.set(true);

    this.service
      .saveDraft(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/leads']);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorKey.set(
            error instanceof Error && 'code' in error
              ? `crm.errors.${(error as { code: string }).code}`
              : 'crm.leads.saveError',
          );
        },
      });
  }

  private currentStatus: LeadStatus = 'new';

  private loadLead(id: string): void {
    this.loading.set(true);

    this.service
      .getLead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lead) => {
          if (lead) {
            this.currentStatus = lead.status;
            this.form.setValue({
              name: lead.name,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              source: lead.source,
              notes: lead.notes,
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
