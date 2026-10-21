import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-module-placeholder',
  template: `
    <div class="placeholder-page">
      <div class="placeholder-icon">{{ icon }}</div>
      <h1 class="placeholder-title">{{ title }}</h1>
      <p class="placeholder-description">{{ description }}</p>
      <div class="placeholder-badge">Under Construction</div>
      <p class="placeholder-hint">This module will be available in a future release.</p>
    </div>
  `,
  styles: `
    .placeholder-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      max-width: 480px;
      margin: 0 auto;
    }
    .placeholder-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .placeholder-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    .placeholder-description {
      font-size: 14px;
      color: var(--gray-500);
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .placeholder-badge {
      display: inline-block;
      padding: 6px 16px;
      background: var(--warning-bg);
      color: #b8860b;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .placeholder-hint {
      font-size: 13px;
      color: var(--gray-400);
    }
  `,
})
export class ModulePlaceholder {
  private route = inject(ActivatedRoute);

  title = this.route.snapshot.data['title'] || 'Module';
  description = this.route.snapshot.data['description'] || '';
  icon = this.route.snapshot.data['icon'] || '🚧';
}
