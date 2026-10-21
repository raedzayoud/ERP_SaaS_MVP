import { Component, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  pageTitleKey = signal('titles.dashboard');

  constructor(private readonly router: Router) {
    this.router.events.subscribe((event) => {
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
