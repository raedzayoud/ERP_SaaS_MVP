import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

@Component({
  selector: 'app-combo-picker',
  imports: [TranslocoPipe],
  templateUrl: './combo-picker.html',
  styleUrl: './combo-picker.css',
})
export class ComboPicker {
  readonly items = input.required<PickerItem[]>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly required = input(false);
  readonly hideLabel = input(false);
  readonly value = input<string | null>(null);
  readonly valueChange = output<string>();

  readonly query = signal('');
  readonly open = signal(false);
  readonly activeIndex = signal(0);
  readonly text = signal('');

  readonly listId = `combo-${Math.random().toString(36).slice(2, 8)}`;
  readonly inputId = `${this.listId}-input`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly selectedLabel = computed(
    () => this.items().find((item) => item.id === this.value())?.label ?? '',
  );

  readonly displayText = computed(() => (this.open() ? this.text() : this.selectedLabel()));

  readonly filtered = computed(() => {
    const search = this.query().trim().toLowerCase();
    if (!search) return this.items();
    return this.items().filter(
      (item) =>
        item.label.toLowerCase().includes(search) ||
        (item.sublabel ?? '').toLowerCase().includes(search),
    );
  });

  readonly activeDescendant = computed(() =>
    this.open() && this.filtered().length > 0 ? `${this.listId}-${this.activeIndex()}` : null,
  );

  onFocus(): void {
    this.open.set(true);
    this.text.set('');
    this.query.set('');
    this.activeIndex.set(0);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    this.query.set(value);
    this.open.set(true);
    this.activeIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filtered();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, Math.max(list.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      if (this.open() && list.length > 0) {
        event.preventDefault();
        this.pick(list[this.activeIndex()]);
      }
    } else if (event.key === 'Escape') {
      if (this.open()) {
        event.preventDefault();
        this.close();
      }
    }
  }

  pick(item: PickerItem): void {
    this.valueChange.emit(item.id);
    this.close();
  }

  close(): void {
    this.open.set(false);
    this.text.set('');
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.close();
  }
}
