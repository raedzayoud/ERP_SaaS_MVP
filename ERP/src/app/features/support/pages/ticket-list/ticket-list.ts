import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { SupportTicket } from '../../models/support-ticket';
import { SupportApiService } from '../../services/support-api.service';

@Component({
  selector: 'app-ticket-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './ticket-list.html',
  styleUrl: './ticket-list.css',
})
export class TicketList {
  private readonly api = inject(SupportApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  tickets = signal<SupportTicket[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');
  search = signal('');
  statusFilter = signal('');
  typeFilter = signal('');
  searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.load();
      });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api
      .getTickets(
        this.search() || undefined,
        this.statusFilter() || undefined,
        this.typeFilter() || undefined,
      )
      .subscribe({
        next: (tickets) => {
          this.tickets.set(tickets);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  delete(ticket: SupportTicket): void {
    if (!window.confirm(this.transloco.translate('support.tickets.deleteConfirm'))) {
      return;
    }

    this.api.deleteTicket(ticket.id).subscribe({
      next: () => {
        this.notice.set('support.tickets.deleted');
        this.load();
      },
      error: () => this.notice.set('support.tickets.loadError'),
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
}
