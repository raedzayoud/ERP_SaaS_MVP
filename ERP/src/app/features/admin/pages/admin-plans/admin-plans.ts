import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CurrencyPipe } from '@angular/common';
import { getAllPlans } from '../../../../core/data/plans';
import { Plan } from '../../../../core/models/plan';
import { PlatformService } from '../../services/platform.service';

@Component({
  selector: 'app-admin-plans',
  imports: [TranslocoDirective, CurrencyPipe],
  templateUrl: './admin-plans.html',
  styleUrl: './admin-plans.css',
})
export class AdminPlans {
  private readonly platformService = inject(PlatformService);
  private readonly transloco = inject(TranslocoService);

  readonly plans = signal<Plan[]>(getAllPlans());

  // ── Inline price editing ─────────────────────────
  readonly editingId = signal<string | null>(null);
  readonly monthlyDraft = signal('');
  readonly annualDraft = signal('');
  readonly priceError = signal('');
  readonly priceSaved = signal('');
  readonly saving = signal(false);

  startEdit(plan: Plan): void {
    this.cancelEdit();
    this.editingId.set(plan.id);
    this.monthlyDraft.set(String(plan.priceMonthly));
    this.annualDraft.set(String(plan.priceAnnual));
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.monthlyDraft.set('');
    this.annualDraft.set('');
    this.priceError.set('');
  }

  onMonthlyInput(event: Event): void {
    this.monthlyDraft.set((event.target as HTMLInputElement).value);
  }

  onAnnualInput(event: Event): void {
    this.annualDraft.set((event.target as HTMLInputElement).value);
  }

  save(plan: Plan): void {
    this.priceError.set('');

    const monthly = Number(this.monthlyDraft());
    const annual = Number(this.annualDraft());
    if (!Number.isFinite(monthly) || monthly <= 0 || !Number.isFinite(annual) || annual <= 0) {
      this.priceError.set(this.transloco.translate('admin.plans.invalidPrice'));
      return;
    }
    if (monthly === plan.priceMonthly && annual === plan.priceAnnual) {
      this.cancelEdit();
      return;
    }

    this.saving.set(true);
    this.platformService.updatePlanPrice(plan.id, monthly, annual).subscribe({
      next: () => {
        this.saving.set(false);
        this.plans.set(getAllPlans());
        this.cancelEdit();
        this.flashSaved('admin.plans.priceSaved');
      },
      error: () => {
        this.saving.set(false);
        this.priceError.set(this.transloco.translate('admin.plans.invalidPrice'));
      },
    });
  }

  resetPrices(): void {
    this.saving.set(true);
    this.platformService.resetPlanPrices().subscribe({
      next: (plans) => {
        this.saving.set(false);
        this.plans.set(plans);
        this.cancelEdit();
        this.flashSaved('admin.plans.pricesReset');
      },
    });
  }

  private flashSaved(key: string): void {
    this.priceSaved.set(this.transloco.translate(key));
    setTimeout(() => this.priceSaved.set(''), 3000);
  }
}
