import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { translateSignal } from '@jsverse/transloco';

@Component({
  selector: 'app-module-placeholder',
  template: `
    <div class="placeholder-page">
      <div class="placeholder-icon">{{ icon }}</div>
      <h1 class="placeholder-title">{{ title() }}</h1>
      <p class="placeholder-description">{{ description() }}</p>
      <div class="placeholder-badge">{{ badge() }}</div>
      <p class="placeholder-hint">{{ hint() }}</p>
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
  private readonly route = inject(ActivatedRoute);

  readonly icon = this.text('icon', '🚧');
  readonly title = translateSignal(this.text('title', 'titles.moduleInactive'));
  readonly description = translateSignal(this.text('description', ''));
  readonly badge = translateSignal('placeholder.badge');
  readonly hint = translateSignal('placeholder.hint');

  private text(name: string, fallback: string): string {
    const value = this.route.snapshot.data[name];
    return typeof value === 'string' ? value : fallback;
  }
}
