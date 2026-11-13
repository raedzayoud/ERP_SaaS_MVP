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
  /** Id of the card being dragged, and the column it is dragged over. */
  dragging = signal<string | null>(null);
  dragOver = signal<string | null>(null);

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

    this.refreshStats();

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
    this.moveToStage(item, select.value as PipelineStage, () => {
      select.value = item.stage;
    });
  }

  onDragStart(item: Opportunity, event: DragEvent): void {
    event.dataTransfer?.setData('text/plain', item.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.dragging.set(item.id);
  }

  onDragEnd(): void {
    this.dragging.set(null);
    this.dragOver.set(null);
  }

  onDragOver(stage: string, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOver.set(stage);
  }

  onDragLeave(stage: string, event: DragEvent): void {
    const column = event.currentTarget as HTMLElement | null;
    // The event also fires when the pointer crosses a child element.
    if (!column) {
      return;
    }
    if (event.relatedTarget && column.contains(event.relatedTarget as Node)) {
      return;
    }
    if (this.dragOver() === stage) {
      this.dragOver.set(null);
    }
  }

  onDrop(stage: PipelineStage, event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.dragging();
    this.dragging.set(null);
    this.dragOver.set(null);
    if (!id) {
      return;
    }

    const item = this.opportunities().find((one) => one.id === id);
    if (!item || item.stage === stage) {
      return;
    }
    this.moveToStage(item, stage);
  }

  remove(item: Opportunity): void {
    this.service
      .deleteOpportunity(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.opportunities.update((list) => list.filter((one) => one.id !== item.id));
        this.refreshStats();
      });
  }

  /** Moves a card right away and puts it back when the API refuses the move. */
  private moveToStage(item: Opportunity, stage: PipelineStage, onError?: () => void): void {
    const previous = item.stage;
    this.errorKey.set(null);
    this.applyStage(item.id, stage);

    this.service
      .updateStage(item.id, stage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.applyStage(updated.id, updated.stage);
          this.refreshStats();
        },
        error: (error: unknown) => {
          this.applyStage(item.id, previous);
          onError?.();
          this.errorKey.set(
            error instanceof Error && 'code' in error
              ? `crm.errors.${(error as { code: string }).code}`
              : 'crm.opportunities.stageError',
          );
        },
      });
  }

  private applyStage(id: string, stage: string): void {
    this.opportunities.update((list) =>
      list.map((one) => (one.id === id ? { ...one, stage } : one)),
    );
  }

  private refreshStats(): void {
    this.service
      .stats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.stats.set(value));
  }
}
