import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OpportunityService } from '../../services/opportunity.service';
import { PartnerService } from '../../services/partner.service';
import { Opportunity } from '../../models/opportunity';
import {
  PIPELINE_STAGES,
  PipelineStage,
  isClosedStage,
  pipelineStats,
} from '../../models/pipeline';

@Component({
  selector: 'app-opportunities',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './opportunities.html',
  styleUrl: './opportunities.css',
})
export class Opportunities {
  private readonly service = inject(OpportunityService);
  private readonly partners = inject(PartnerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stages = PIPELINE_STAGES;

  opportunities = signal<Opportunity[]>([]);
  customerNames = signal<Map<string, string>>(new Map());
  stats = signal<ReturnType<typeof pipelineStats> | null>(null);
  loading = signal(true);
  loadFailed = signal(false);
  errorKey = signal<string | null>(null);

  columns = computed(() =>
    this.stages.map((stage) => ({
      stage,
      closed: isClosedStage(stage),
      items: this.opportunities().filter((item) => item.stage === stage),
    })),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service
      .getOpportunities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.opportunities.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });

    this.service
      .stats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.stats.set(value));

    this.partners
      .getPartners({ page: 0, size: 500, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((page) => {
        const map = new Map<string, string>();
        for (const partner of page.items) {
          map.set(partner.id, partner.name);
        }
        this.customerNames.set(map);
      });
  }

  customerName(opportunity: Opportunity): string {
    return this.customerNames().get(opportunity.customerId) ?? '—';
  }

  stageKey(stage: string): string {
    return `crm.pipeline.stage.${stage}`;
  }

  onStageChange(item: Opportunity, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const stage = select.value as PipelineStage;

    this.errorKey.set(null);

    this.service
      .updateStage(item.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.opportunities.update((list) =>
            list.map((one) => (one.id === updated.id ? updated : one)),
          );
          // refresh the KPI band after the stage change
          this.service
            .stats()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((value) => this.stats.set(value));
        },
        error: (error: unknown) => {
          select.value = item.stage;
          this.errorKey.set(
            error instanceof Error && 'code' in error
              ? `crm.errors.${(error as { code: string }).code}`
              : 'crm.opportunities.stageError',
          );
        },
      });
  }

  remove(item: Opportunity): void {
    this.service
      .deleteOpportunity(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.opportunities.update((list) => list.filter((one) => one.id !== item.id));
        this.service
          .stats()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((value) => this.stats.set(value));
      });
  }
}
