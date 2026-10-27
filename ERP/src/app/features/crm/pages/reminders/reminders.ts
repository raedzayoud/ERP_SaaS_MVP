import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InteractionService } from '../../services/interaction.service';
import { PartnerService } from '../../services/partner.service';
import { CrmInteraction } from '../../models/crm-interaction';

@Component({
  selector: 'app-reminders',
  imports: [DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './reminders.html',
  styleUrl: './reminders.css',
})
export class Reminders {
  private readonly interactionService = inject(InteractionService);
  private readonly partners = inject(PartnerService);
  private readonly destroyRef = inject(DestroyRef);

  rows = signal<{ item: CrmInteraction; partnerName: string; overdue: boolean }[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  errorKey = signal<string | null>(null);
  notice = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const today = new Date().toISOString().slice(0, 10);

    this.interactionService
      .getPendingReminders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (items.length === 0) {
            this.rows.set([]);
            this.loading.set(false);
            return;
          }

          // Reminder rows need the contact name: one lookup per contact.
          const nameByPartner = new Map<string, string>();
          const partners = [...new Set(items.map((item) => item.partnerId))];

          forkJoin(
            partners.map((id) => this.partners.getPartner(id)),
          )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((found) => {
              for (const partner of found) {
                if (partner) nameByPartner.set(partner.id, partner.name);
              }

              this.rows.set(
                items.map((item) => ({
                  item,
                  partnerName: nameByPartner.get(item.partnerId) ?? '—',
                  overdue: (item.reminderAt ?? '') < today,
                })),
              );
              this.loading.set(false);
            });
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  markDone(row: { item: CrmInteraction }): void {
    this.errorKey.set(null);

    this.interactionService
      .markReminderDone(row.item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('crm.reminders.doneNotice');
          this.load();
        },
        error: (error: unknown) => {
          this.errorKey.set(
            error instanceof Error && 'code' in error
              ? `crm.errors.${(error as { code: string }).code}`
              : 'crm.reminders.actionError',
          );
        },
      });
  }

  typeKey(item: CrmInteraction): string {
    return `crm.interactions.type.${item.type}`;
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}
