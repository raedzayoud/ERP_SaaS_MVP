import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeadService } from '../../services/lead.service';
import { Lead, LeadStatus } from '../../models/lead';

@Component({
  selector: 'app-leads',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
})
export class Leads {
  private readonly service = inject(LeadService);
  private readonly destroyRef = inject(DestroyRef);

  leads = signal<Lead[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');
  errorKey = signal<string | null>(null);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  statusFilter = signal<LeadStatus | ''>('');

  counts = computed(() => {
    const by = (s: LeadStatus) => this.leads().filter((lead) => lead.status === s).length;
    return {
      new: by('new'),
      contacted: by('contacted'),
      qualified: by('qualified'),
      converted: by('converted'),
      lost: by('lost'),
    };
  });

  hasFilters = computed(() => this.search() !== '' || this.statusFilter() !== '');

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

    this.service
      .getLeads({
        page: 0,
        size: 200,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
        sort: 'createdAt,desc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.leads.set(page.items);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as LeadStatus | '');
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.set('');
    this.load();
  }

  convert(lead: Lead): void {
    this.errorKey.set(null);

    this.service
      .convertLead(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('crm.leads.convertedNotice');
          this.load();
        },
        error: (error: unknown) => this.showActionError(error, 'crm.leads.convertError'),
      });
  }

  lose(lead: Lead): void {
    this.errorKey.set(null);

    this.service
      .loseLead(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('crm.leads.lostNotice');
          this.load();
        },
        error: (error: unknown) => this.showActionError(error, 'crm.leads.loseError'),
      });
  }

  remove(lead: Lead): void {
    this.service
      .deleteLead(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showNotice('crm.leads.deletedNotice');
        this.load();
      });
  }

  statusKey(lead: Lead): string {
    return `crm.leads.status.${lead.status}`;
  }

  sourceKey(lead: Lead): string {
    return `crm.leads.source.${lead.source}`;
  }

  private showActionError(error: unknown, fallbackKey: string): void {
    this.errorKey.set(fallbackKey);
    void error;
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}
