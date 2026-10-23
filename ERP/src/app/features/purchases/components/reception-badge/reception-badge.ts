import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReceptionState } from '../../models/purchase-order';

const RECEPTION_BADGE: Record<ReceptionState, string> = {
  none: 'badge-warning',
  partial: 'badge-info',
  complete: 'badge-success',
};

@Component({
  selector: 'app-reception-badge',
  imports: [TranslocoPipe],
  templateUrl: './reception-badge.html',
})
export class ReceptionBadge {
  readonly state = input.required<ReceptionState>();

  readonly badgeClass = computed(() => RECEPTION_BADGE[this.state()]);
}
