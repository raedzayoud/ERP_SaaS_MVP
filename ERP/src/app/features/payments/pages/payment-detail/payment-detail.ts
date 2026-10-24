import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Payment } from '../../models/payment';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './payment-detail.html',
  styleUrl: './payment-detail.css',
})
export class PaymentDetail {
  private readonly service = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly paymentId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly payment = signal<Payment | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.paymentId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.service
      .getPayment(this.paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => {
          if (payment) {
            this.payment.set(payment);
          } else {
            this.loadFailed.set(true);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }
}
