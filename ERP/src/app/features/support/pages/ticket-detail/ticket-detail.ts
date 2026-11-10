import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PermissionService } from '../../../../core/services/permission.service';
import { InteractionChannel, TicketInteraction } from '../../models/ticket-interaction';
import { SupportTicket } from '../../models/support-ticket';
import { SupportApiService } from '../../services/support-api.service';

@Component({
  selector: 'app-ticket-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
})
export class TicketDetail {
  private readonly api = inject(SupportApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  readonly permissions = inject(PermissionService);

  readonly ticketId = this.route.snapshot.paramMap.get('id');

  ticket = signal<SupportTicket | null>(null);
  interactions = signal<TicketInteraction[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);
  notice = signal('');

  form = this.fb.nonNullable.group({
    author: ['', Validators.required],
    channel: ['note' as InteractionChannel, Validators.required],
    message: ['', Validators.required],
  });

  constructor() {
    if (this.ticketId) {
      this.load(this.ticketId);
    } else {
      this.loading.set(false);
      this.loadFailed.set(true);
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getTicket(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });

    this.loadInteractions(id);
  }

  loadInteractions(id: string): void {
    this.api.getInteractions(id).subscribe({
      next: (interactions) => this.interactions.set(interactions),
    });
  }

  addInteraction(): void {
    const id = this.ticketId;
    if (!id) return;

    this.submitted.set(true);
    this.submitFailed.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.api.addInteraction(id, this.form.getRawValue()).subscribe({
      next: () => {
        this.notice.set('support.detail.added');
        this.saving.set(false);
        this.submitted.set(false);
        this.form.reset({ author: '', channel: 'note', message: '' });
        this.loadInteractions(id);
      },
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  deleteTicket(): void {
    if (!this.ticketId) return;
    if (!window.confirm(this.transloco.translate('support.detail.deleteConfirm'))) return;

    this.api.deleteTicket(this.ticketId).subscribe({
      next: () => void this.router.navigate(['/support/tickets']),
    });
  }

  statusClass(status: string): string {
    if (status === 'resolved' || status === 'closed') return 'badge badge-success';
    if (status === 'in_progress') return 'badge badge-info';
    return 'badge badge-warning';
  }

  priorityClass(priority: string): string {
    if (priority === 'urgent' || priority === 'high') return 'badge badge-danger';
    if (priority === 'medium') return 'badge badge-warning';
    return 'badge badge-info';
  }

  isInvalid(field: 'author' | 'message'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }
}
