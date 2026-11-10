import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { CustomerSegment } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-segment-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './segment-list.html',
  styleUrl: './segment-list.css',
})
export class SegmentList {
  private readonly api = inject(MarketingApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  segments = signal<CustomerSegment[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');
  noticeError = signal(false);
  search = signal('');
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
      .getSegments(this.search() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segments) => {
          this.segments.set(segments);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  delete(segment: CustomerSegment): void {
    if (!window.confirm(this.transloco.translate('marketing.segments.deleteConfirm'))) {
      return;
    }

    this.api
      .deleteSegment(segment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('marketing.segments.deleted');
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.showNotice(
            error.status === 409
              ? 'marketing.segments.deleteBlocked'
              : 'marketing.segments.loadError',
            true,
          );
        },
      });
  }

  private showNotice(key: string, error = false): void {
    this.notice.set(key);
    this.noticeError.set(error);
    setTimeout(() => this.notice.set(''), 4000);
  }
}
