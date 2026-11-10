import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PermissionService } from '../../../../core/services/permission.service';
import { KnowledgeArticle } from '../../models/knowledge-article';
import { SupportApiService } from '../../services/support-api.service';

type CheckedField = 'title' | 'category' | 'body';

@Component({
  selector: 'app-knowledge-base',
  imports: [DatePipe, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './knowledge-base.html',
  styleUrl: './knowledge-base.css',
})
export class KnowledgeBase {
  private readonly api = inject(SupportApiService);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  readonly permissions = inject(PermissionService);

  articles = signal<KnowledgeArticle[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  saving = signal(false);
  submitted = signal(false);
  submitFailed = signal(false);
  notice = signal('');
  editingId = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    category: ['', Validators.required],
    body: ['', Validators.required],
    published: [true],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
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

  edit(article: KnowledgeArticle): void {
    this.editingId.set(article.id);
    this.submitted.set(false);
    this.form.patchValue(article);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.submitted.set(false);
    this.form.reset({ title: '', category: '', body: '', published: true });
  }

  submit(): void {
    this.submitted.set(true);
    this.submitFailed.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const id = this.editingId();
    const input = this.form.getRawValue();
    const request = id ? this.api.updateArticle(id, input) : this.api.createArticle(input);

    request.subscribe({
      next: () => {
        this.notice.set('common.saved');
        this.saving.set(false);
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  delete(article: KnowledgeArticle): void {
    if (!window.confirm(this.transloco.translate('support.knowledge.deleteConfirm'))) {
      return;
    }

    this.api.deleteArticle(article.id).subscribe({
      next: () => {
        this.notice.set('support.knowledge.deleted');
        this.load();
      },
    });
  }

  isInvalid(field: CheckedField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }
}
