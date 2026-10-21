import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { COUNTRIES } from '../../../../core/data/countries';
import { PartnerService } from '../../services/partner.service';
import { Partner, PartnerInput, PartnerKind } from '../../models/partner';

type CheckedControl = 'name' | 'email';

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './contact-form.html',
})
export class ContactForm {
  private readonly service = inject(PartnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly countries = COUNTRIES;
  readonly partnerId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.partnerId !== null;

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);

  kind = signal<PartnerKind>('company');
  companies = signal<Partner[]>([]);

  form = this.fb.nonNullable.group({
    kind: ['company' as PartnerKind, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    parentId: [''],
    isCustomer: [false],
    isSupplier: [false],
    taxId: [''],
    email: ['', Validators.email],
    phone: [''],
    jobTitle: [''],
    street: [''],
    city: [''],
    country: ['TN'],
    notes: [''],
  });

  constructor() {
    this.form.controls.kind.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.kind.set(value));

    this.loadCompanies();

    if (this.partnerId) {
      this.loadPartner(this.partnerId);
    }
  }

  isInvalid(controlName: CheckedControl): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(controlName: CheckedControl, error: string): boolean {
    return this.isInvalid(controlName) && this.form.controls[controlName].hasError(error);
  }

  submit(): void {
    this.submitted.set(true);
    this.submitFailed.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: PartnerInput = {
      kind: raw.kind,
      name: raw.name.trim(),
      parentId: raw.parentId || null,
      isCustomer: raw.isCustomer,
      isSupplier: raw.isSupplier,
      taxId: raw.taxId.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      jobTitle: raw.jobTitle.trim(),
      address: {
        street: raw.street.trim(),
        city: raw.city.trim(),
        country: raw.country.trim(),
      },
      notes: raw.notes.trim(),
    };

    this.saving.set(true);

    const request$ =
      this.isEdit && this.partnerId
        ? this.service.updatePartner(this.partnerId, input)
        : this.service.createPartner(input);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/contacts']);
      },
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  private loadPartner(id: string): void {
    this.loading.set(true);

    this.service
      .getPartner(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partner) => {
          if (partner) {
            this.fillForm(partner);
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

  private loadCompanies(): void {
    this.service
      .getPartners({
        page: 0,
        size: 100,
        kind: 'company',
        active: true,
        sort: 'name,asc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.companies.set(result.items));
  }

  private fillForm(partner: Partner): void {
    this.form.setValue({
      kind: partner.kind,
      name: partner.name,
      parentId: partner.parentId ?? '',
      isCustomer: partner.isCustomer,
      isSupplier: partner.isSupplier,
      taxId: partner.taxId,
      email: partner.email,
      phone: partner.phone,
      jobTitle: partner.jobTitle,
      street: partner.address.street,
      city: partner.address.city,
      country: partner.address.country,
      notes: partner.notes,
    });
  }
}
