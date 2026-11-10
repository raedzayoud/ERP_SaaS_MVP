import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { Partner } from '../../../crm/models/partner';
import { PartnerService } from '../../../crm/services/partner.service';
import { CustomerSegmentInput } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-segment-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './segment-form.html',
  styleUrl: './segment-form.css',
})
export class SegmentForm {
  private readonly api = inject(MarketingApiService);
  private readonly partners = inject(PartnerService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly segmentId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.segmentId;

  customers = signal<Partner[]>([]);
  selectedIds = signal<string[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notFound = signal(false);
  saving = signal(false);
  submitted = signal(false);
  saveFailed = signal(false);

  unknownIds = computed(() => {
    const known = new Set(this.customers().map((customer) => customer.id));
    return this.selectedIds().filter((id) => !known.has(id));
  });

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);

    const customers$ = this.partners.getPartners({ page: 0, size: 100, active: true });

    if (!this.segmentId) {
      customers$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (page) => {
            this.customers.set(page.items.filter((partner) => partner.isCustomer));
            this.loading.set(false);
          },
          error: () => {
            this.loadFailed.set(true);
            this.loading.set(false);
          },
        });
      return;
    }

    forkJoin({
      customers: customers$,
      segment: this.api.getSegment(this.segmentId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ customers, segment }) => {
          this.customers.set(customers.items.filter((partner) => partner.isCustomer));
          this.selectedIds.set(segment.customerIds);
          this.form.patchValue({
            name: segment.name,
            description: segment.description ?? '',
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

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update((ids) =>
      checked ? [...ids, id] : ids.filter((value) => value !== id),
    );
  }

  remove(id: string): void {
    this.selectedIds.update((ids) => ids.filter((value) => value !== id));
  }

  isNameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.invalid && (control.touched || this.submitted());
  }

  submit(): void {
    this.submitted.set(true);
    this.saveFailed.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const input: CustomerSegmentInput = {
      name: value.name.trim(),
      description: value.description.trim(),
      customerIds: this.selectedIds(),
    };

    const request = this.segmentId
      ? this.api.updateSegment(this.segmentId, input)
      : this.api.createSegment(input);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate(['/marketing/segments']),
      error: () => {
        this.saveFailed.set(true);
        this.saving.set(false);
      },
    });
  }
}
