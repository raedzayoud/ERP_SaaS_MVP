import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { Plan } from '../../../../core/models/plan';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
  selector: 'app-admin-plans',
  imports: [TranslocoDirective, CurrencyPipe],
  templateUrl: './admin-plans.html',
  styleUrl: './admin-plans.css',
})
export class AdminPlans {
  private readonly adminApi = inject(AdminApiService);

  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.adminApi.getPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }
}
