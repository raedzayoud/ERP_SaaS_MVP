import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  template: `
    <div class="not-found">
      <div class="not-found-code">404</div>
      <h1 class="not-found-title">Page Not Found</h1>
      <p class="not-found-text">The page you are looking for does not exist or has been moved.</p>
      <a routerLink="/dashboard" class="btn btn-primary">Go to Dashboard</a>
    </div>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
    }
    .not-found-code {
      font-size: 72px;
      font-weight: 800;
      color: var(--gray-200);
      line-height: 1;
      margin-bottom: 8px;
    }
    .not-found-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    .not-found-text {
      font-size: 14px;
      color: var(--gray-500);
      margin-bottom: 24px;
    }
  `,
  imports: [RouterLink],
})
export class NotFoundComponent {}
