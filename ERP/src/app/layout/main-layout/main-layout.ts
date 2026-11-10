import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../core/services/tenant.service';
import { Sidebar } from '../sidebar/sidebar';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, Sidebar, Navbar, TranslocoDirective],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  pageTitleKey = signal('titles.dashboard');

  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  readonly trial = computed(() => {
    const tenant = this.tenantService.currentTenant();
    if (tenant?.tenantStatus !== 'TRIAL') return null;

    const limit = tenant.trialLimit ?? 0;
    const used = tenant.trialUsed ?? 0;
    return { remaining: Math.max(0, limit - used), limit };
  });

  constructor() {
    // Auto-unsubscribed when the layout is destroyed.
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.updatePageTitle();
        }
      });

    this.updatePageTitle();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  private updatePageTitle(): void {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const title = route.data['title'];
    this.pageTitleKey.set(typeof title === 'string' ? title : 'titles.dashboard');
  }
}
