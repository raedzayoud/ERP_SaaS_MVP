import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { HrApiService } from '../../services/hr-api.service';

@Component({
  selector: 'app-hr-dashboard',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './hr-dashboard.html',
  styleUrl: './hr-dashboard.css',
})
export class HrDashboard {
  private readonly api = inject(HrApiService);

  totalEmployees = signal(0);
  onLeave = signal(0);
  pendingLeave = signal(0);
  roles = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getDashboard().subscribe({
      next: (stats) => {
        this.totalEmployees.set(stats.totalEmployees);
        this.onLeave.set(stats.onLeave);
        this.pendingLeave.set(stats.pendingLeave);
        this.roles.set(stats.roles);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }
}
