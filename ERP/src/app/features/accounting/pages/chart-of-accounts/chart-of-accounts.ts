import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantService } from '../../../../core/services/tenant.service';
import { Account, TrialBalanceRow } from '../../models/journal';
import { AccountingService } from '../../services/accounting.service';

@Component({
  selector: 'app-chart-of-accounts',
  imports: [CurrencyPipe, RouterLink, TranslocoDirective],
  templateUrl: './chart-of-accounts.html',
  styleUrl: './chart-of-accounts.css',
})
export class ChartOfAccounts {
  private readonly service = inject(AccountingService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly accounts = signal<Account[]>([]);
  readonly balance = signal<TrialBalanceRow[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  /** The currency of the current workspace, used for all money displays. */
  readonly currency = computed(() => this.tenantService.activeCurrency());

  readonly totalDebit = computed(() => this.balance().reduce((sum, row) => sum + row.debit, 0));
  readonly totalCredit = computed(() => this.balance().reduce((sum, row) => sum + row.credit, 0));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service.getChartOfAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loadBalance();
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadBalance(): void {
    this.service.getTrialBalance().subscribe({
      next: (rows) => {
        this.balance.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  balanceRow(code: string): TrialBalanceRow | undefined {
    return this.balance().find((row) => row.code === code);
  }
}
