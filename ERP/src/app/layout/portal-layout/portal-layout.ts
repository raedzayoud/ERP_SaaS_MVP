import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-portal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective],
  templateUrl: './portal-layout.html',
  styleUrl: './portal-layout.css',
})
export class PortalLayout {
  readonly authService = inject(AuthService);
  readonly languageService = inject(LanguageService);
  readonly tenantService = inject(TenantService);

  readonly availableLangs = this.languageService.availableLangs;
  readonly currentLang = this.languageService.currentLang;

  onLangChange(event: Event): void {
    this.languageService.setLang((event.target as HTMLSelectElement).value);
  }

  logout(): void {
    this.authService.logout();
  }

  get userInitials(): string {
    const user = this.authService.currentUser();
    if (!user) return '?';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
