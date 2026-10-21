import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-module-inactive',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './module-inactive.html',
  styleUrl: './module-inactive.css',
})
export class ModuleInactive {
  private readonly route = inject(ActivatedRoute);
  private readonly tenantService = inject(TenantService);

  module = signal('');

  hasWorkspace = computed(() => this.tenantService.currentTenant() !== null);
  moduleTitleKey = computed(() => `titles.${this.module()}`);

  constructor() {
    this.module.set(this.route.snapshot.queryParamMap.get('module') ?? '');
  }
}
