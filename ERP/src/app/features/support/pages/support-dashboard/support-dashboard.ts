import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { KnowledgeArticle } from '../../models/knowledge-article';
import { SupportTicket } from '../../models/support-ticket';
import { SupportApiService } from '../../services/support-api.service';

@Component({
  selector: 'app-support-dashboard',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './support-dashboard.html',
  styleUrl: './support-dashboard.css',
})
export class SupportDashboard {
  private readonly api = inject(SupportApiService);

  tickets = signal<SupportTicket[]>([]);
  articles = signal<KnowledgeArticle[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  openTickets = computed(
    () => this.tickets().filter((ticket) => ticket.status === 'open').length,
  );
  inProgress = computed(
    () => this.tickets().filter((ticket) => ticket.status === 'in_progress').length,
  );
  resolved = computed(
    () => this.tickets().filter((ticket) => ticket.status === 'resolved').length,
  );
  articleCount = computed(() => this.articles().length);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getTickets().subscribe({
      next: (tickets) => this.tickets.set(tickets),
      error: () => this.loadFailed.set(true),
    });

    this.api.getArticles().subscribe({
      next: (articles) => {
        this.articles.set(articles);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }
}
