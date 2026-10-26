import { Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CurrencyPipe } from '@angular/common';
import { PLANS } from '../../../../core/data/plans';

@Component({
  selector: 'app-admin-plans',
  imports: [TranslocoDirective, CurrencyPipe],
  templateUrl: './admin-plans.html',
  styleUrl: './admin-plans.css',
})
export class AdminPlans {
  readonly plans = PLANS;
}
