import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerService } from '../../services/partner.service';
import { Partner, PartnerKind, PartnerQuery } from '../../models/partner';

type ActiveFilter = 'active' | 'archived' | 'all';
type SortField = 'name' | 'createdAt';

@Component({
  selector: 'app-contacts',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './contacts.html',
  styleUrl: './contacts.css',
})
export class Contacts {
  private readonly service = inject(PartnerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 10;

  partners = signal<Partner[]>([]);
  companies = signal<Partner[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  kindFilter = signal<PartnerKind | ''>('');
  activeFilter = signal<ActiveFilter>('active');
  sort = signal('name,asc');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () => this.search() !== '' || this.kindFilter() !== '' || this.activeFilter() !== 'active',
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.page.set(0);
        this.load();
      });

    this.load();
    this.loadCompanies();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const query: PartnerQuery = {
      page: this.page(),
      size: this.pageSize,
      search: this.search() || undefined,
      kind: this.kindFilter() || undefined,
      active: this.activeFilter() === 'all' ? undefined : this.activeFilter() === 'active',
      sort: this.sort(),
    };

    this.service
      .getPartners(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.partners.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  companyName(partner: Partner): string {
    if (partner.kind !== 'person' || !partner.parentId) return '';
    return this.companies().find((company) => company.id === partner.parentId)?.name ?? '';
  }

  setPage(nextPage: number): void {
    if (nextPage < 0 || nextPage >= this.totalPages() || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.load();
  }

  setSort(field: SortField): void {
    const [currentField, currentDirection] = this.sort().split(',');
    const direction = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
    this.sort.set(`${field},${direction}`);
    this.page.set(0);
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

  onKindFilter(event: Event): void {
    this.kindFilter.set((event.target as HTMLSelectElement).value as PartnerKind | '');
    this.page.set(0);
    this.load();
  }

  onActiveFilter(event: Event): void {
    this.activeFilter.set((event.target as HTMLSelectElement).value as ActiveFilter);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.kindFilter.set('');
    this.activeFilter.set('active');
    this.page.set(0);
    this.load();
  }

  archive(partner: Partner): void {
    this.service
      .archivePartner(partner.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showNotice('contacts.archived');
        this.load();
      });
  }

  restore(partner: Partner): void {
    this.service
      .restorePartner(partner.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showNotice('contacts.restored');
        this.load();
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

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}
