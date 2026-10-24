import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PRODUCT_VAT_RATES } from '../../../products/models/product';
import { InvoicingSettings } from '../../models/invoicing-settings';
import { InvoicingSettingsService } from '../../services/invoicing-settings.service';

@Component({
  selector: 'app-invoicing-settings',
  imports: [TranslocoDirective],
  templateUrl: './invoicing-settings.html',
  styleUrl: './invoicing-settings.css',
})
export class InvoicingSettingsPage {
  private readonly service = inject(InvoicingSettingsService);
  private readonly transloco = inject(TranslocoService);

  readonly vatRates = PRODUCT_VAT_RATES;
  readonly settings = this.service.settings;

  readonly invoicePrefix = signal('');
  readonly creditNotePrefix = signal('');
  readonly quotePrefix = signal('');
  readonly defaultVatRate = signal(19);
  readonly defaultStampDuty = signal(0);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorKey = signal<string | null>(null);

  constructor() {
    const current = this.settings();
    this.invoicePrefix.set(current.invoicePrefix);
    this.creditNotePrefix.set(current.creditNotePrefix);
    this.quotePrefix.set(current.quotePrefix);
    this.defaultVatRate.set(current.defaultVatRate);
    this.defaultStampDuty.set(current.defaultStampDuty);
  }

  saveNumbering(): void {
    this.save({
      invoicePrefix: this.invoicePrefix().trim().toUpperCase(),
      creditNotePrefix: this.creditNotePrefix().trim().toUpperCase(),
      quotePrefix: this.quotePrefix().trim().toUpperCase(),
    });
  }

  saveTaxes(): void {
    this.save({
      defaultVatRate: this.defaultVatRate(),
      defaultStampDuty: this.defaultStampDuty(),
    });
  }

  toggleRate(rate: number, checked: boolean): void {
    const active = new Set(this.settings().activeVatRates);
    if (checked) {
      active.add(rate);
    } else {
      if (active.size <= 1) return;
      active.delete(rate);
    }
    this.save({ activeVatRates: [...active].sort((a, b) => a - b) });
  }

  private save(patch: Partial<InvoicingSettings>): void {
    this.saving.set(true);
    this.errorKey.set(null);
    this.saved.set(false);

    const before = JSON.stringify(this.settings());
    this.service.update(patch);
    const after = JSON.stringify(this.settings());

    if (before === after) {
      this.saving.set(false);
      this.errorKey.set('invoicing.errors.invalidPrefix');
      return;
    }

    setTimeout(() => {
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    }, 300);
  }

  translate(key: string): string {
    return this.transloco.translate(key);
  }
}
