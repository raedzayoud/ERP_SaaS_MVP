import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  SupportTicketInput,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../../models/support-ticket';
import { SupportApiService } from '../../services/support-api.service';

type CheckedField = 'subject' | 'description' | 'requesterName' | 'requesterEmail';

@Component({
  selector: 'app-ticket-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './ticket-form.html',
  styleUrl: './ticket-form.css',
})
export class TicketForm {
  private readonly api = inject(SupportApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly ticketId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.ticketId !== null;

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', Validators.required],
    requesterName: ['', Validators.required],
    requesterEmail: ['', [Validators.required, Validators.email]],
    type: ['ticket' as TicketType, Validators.required],
    priority: ['medium' as TicketPriority, Validators.required],
    status: ['open' as TicketStatus, Validators.required],
    assignee: [''],
  });

  constructor() {
    if (this.ticketId) {
      this.load(this.ticketId);
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.api.getTicket(id).subscribe({
      next: (ticket) => {
        this.form.patchValue(ticket);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  isInvalid(field: CheckedField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(field: CheckedField, error: string): boolean {
    return this.isInvalid(field) && this.form.controls[field].hasError(error);
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.submitFailed.set(false);
    const input = this.form.getRawValue() as SupportTicketInput;
    const request = this.ticketId
      ? this.api.updateTicket(this.ticketId, input)
      : this.api.createTicket(input);

    request.subscribe({
      next: () => void this.router.navigate(['/support/tickets']),
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }
}
