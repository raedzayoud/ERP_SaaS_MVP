import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export type BadgeStatus = 'draft' | 'posted' | 'confirmed' | 'cancelled';
export type BadgePaymentState = 'none' | 'unpaid' | 'partial' | 'paid';
export type BadgeScope = 'invoices' | 'purchases' | 'sales';

const STATUS_BADGE: Record<BadgeStatus, string> = {
  draft: 'badge-info',
  posted: 'badge-primary',
  confirmed: 'badge-primary',
  cancelled: 'badge-warning',
};

const PAYMENT_BADGE: Record<BadgePaymentState, string> = {
  none: '',
  unpaid: 'badge-warning',
  partial: 'badge-info',
  paid: 'badge-success',
};

@Component({
  selector: 'app-status-badge',
  imports: [TranslocoPipe],
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  readonly status = input.required<BadgeStatus>();
  readonly payment = input<BadgePaymentState>('none');
  readonly overdue = input(false);
  readonly scope = input<BadgeScope>('invoices');

  readonly statusClass = computed(() => STATUS_BADGE[this.status()]);
  readonly paymentClass = computed(() => PAYMENT_BADGE[this.payment()]);
}
