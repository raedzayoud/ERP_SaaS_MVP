import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart-canvas',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styles: [
    `
      :host {
        display: block;
        position: relative;
        height: 100%;
        width: 100%;
      }

      canvas {
        width: 100% !important;
        height: 100% !important;
      }
    `,
  ],
})
export class ChartCanvas implements AfterViewInit, OnDestroy {
  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartConfiguration['data']>();
  readonly options = input<ChartConfiguration['options']>({});

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;
  private ready = false;

  constructor() {
    effect(() => {
      if (!this.ready) return;
      this.render(this.type(), this.data(), this.options());
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.render(this.type(), this.data(), this.options());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private render(
    type: ChartType,
    data: ChartConfiguration['data'],
    options: ChartConfiguration['options'],
  ): void {
    this.chart?.destroy();

    this.chart = new Chart(this.canvasRef().nativeElement, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
      },
    });
  }
}
