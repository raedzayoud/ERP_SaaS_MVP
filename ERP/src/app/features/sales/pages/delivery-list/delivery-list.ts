import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { DeliveryNote, DeliveryQuery } from '../../models/delivery-note';
import { DeliveryNoteService } from '../../services/delivery-note.service';

type SortField = 'deliveryDate' | 'deliveryNumber';

@Component({
  selector: 'app-delivery-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './delivery-list.html',
  styleUrl: './delivery-list.css',
})
export class DeliveryList {
  private readonly service = inject(DeliveryNoteService);
  private readonly destroyRef = inject(DestroyRef);

  deliveries = signal<DeliveryNote[]>([]);
  total = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  from = signal('');
  to = signal('');
  sort = signal('deliveryDate,desc');

  totalIssued = computed(() => this.total());
  yearCount = signal(0);

  hasFilters = computed(() => this.search() !== '' || this.from() !== '' || this.to() !== '');

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

    const query: DeliveryQuery = {
      search: this.search() || undefined,
      from: this.from() || undefined,
      to: this.to() || undefined,
      sort: this.sort(),
    };

    this.service
      .getDeliveries(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deliveries.set(result.items);
          this.total.set(result.total);
          this.yearCount.set(
            result.items.filter(
              (note) => note.deliveryNumber.slice(0, 7) === `BL-${new Date().getFullYear()}`,
            ).length,
          );
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onDateFilter(event: Event, field: 'from' | 'to'): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'from') this.from.set(value);
    else this.to.set(value);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.from.set('');
    this.to.set('');
    this.load();
  }

  setSort(field: SortField): void {
    const [currentField, currentDirection] = this.sort().split(',');
    const direction = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
    this.sort.set(`${field},${direction}`);
    this.load();
  }

  sortIcon(field: SortField): string {
    const [currentField, currentDirection] = this.sort().split(',');
    if (currentField !== field) return '';
    return currentDirection === 'desc' ? '↓' : '↑';
  }

  ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    const [currentField, currentDirection] = this.sort().split(',');
    if (currentField !== field) return 'none';
    return currentDirection === 'desc' ? 'descending' : 'ascending';
  }

  orderLabelOf(note: DeliveryNote): string {
    return note.salesOrderNumber ?? '—';
  }
}
