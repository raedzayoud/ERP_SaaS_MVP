import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { getPlanById } from '../../../../core/data/plans';
import {
  SignupReview,
  SignupReviewDocument,
} from '../../models/kyc-review';
import { KycAdminApiService } from '../../services/kyc-admin-api.service';

const FLAGS: Record<string, string> = {
  TN: '🇹🇳',
  MA: '🇲🇦',
  DZ: '🇩🇿',
  FR: '🇫🇷',
  SE: '🇸🇪',
  DE: '🇩🇪',
  BE: '🇧🇪',
  CH: '🇨🇭',
  US: '🇺🇸',
  CA: '🇨🇦',
};

/** Icon displayed on the preview of each KYC document type. */
const DOC_ICONS: Record<string, string> = {
  idCardRecto: '🪪',
  idCardVerso: '🪪',
  tradeRegister: '🏛️',
  taxRegistration: '🧮',
};

@Component({
  selector: 'app-admin-signups',
  imports: [DatePipe, TranslocoDirective],
  templateUrl: './admin-signups.html',
  styleUrl: './admin-signups.css',
})
export class AdminSignups implements OnDestroy {
  private readonly api = inject(KycAdminApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly sanitizer = inject(DomSanitizer);

  /** KYC documents expected from the registration form. */
  readonly documentKeys = [
    'idCardRecto',
    'idCardVerso',
    'tradeRegister',
    'taxRegistration',
  ] as const;

  pending = signal<SignupReview[]>([]);
  approved = signal<SignupReview[]>([]);
  rejected = signal<SignupReview[]>([]);
  signups = computed(() => [...this.pending(), ...this.approved(), ...this.rejected()]);

  loading = signal(true);
  loadErrorKey = signal('');
  decidingId = signal<string | null>(null);
  rejectFor = signal<string | null>(null);
  note = signal('');
  message = signal('');
  decisionErrorKey = signal('');

  /** Open KYC document viewer: the clicked document of the clicked request. */
  viewer = signal<{ signup: SignupReview; doc: SignupReviewDocument } | null>(null);
  docUrl = signal<SafeResourceUrl | null>(null);
  docLoading = signal(false);
  docErrorKey = signal('');
  private docObjectUrl: string | null = null;

  pendingCount = computed(() => this.pending().length);
  approvedCount = computed(() => this.approved().length);
  rejectedCount = computed(() => this.rejected().length);

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.revokeDocUrl();
  }

  load(): void {
    this.loading.set(true);
    this.loadErrorKey.set('');

    forkJoin({
      pending: this.api.list('PENDING'),
      approved: this.api.list('APPROVED'),
      rejected: this.api.list('REJECTED'),
    }).subscribe({
      next: ({ pending, approved, rejected }) => {
        this.pending.set(pending);
        this.approved.set(approved);
        this.rejected.set(rejected);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadErrorKey.set('admin.signups.loadError');
      },
    });
  }

  approve(signup: SignupReview): void {
    if (this.decidingId()) return;
    this.decidingId.set(signup.tenant.id);
    this.decisionErrorKey.set('');

    this.api.approve(signup.tenant.id).subscribe({
      next: () => {
        this.decidingId.set(null);
        this.message.set(
          this.t('admin.signups.approvedMsg', { company: signup.tenant.companyName }),
        );
        this.clearLater();
        this.load();
      },
      error: (error: unknown) => {
        this.decidingId.set(null);
        this.decisionErrorKey.set(this.decisionError(error));
      },
    });
  }

  askReject(signup: SignupReview): void {
    this.rejectFor.set(signup.tenant.id);
    this.note.set('');
    this.message.set('');
    this.decisionErrorKey.set('');
  }

  reject(): void {
    const id = this.rejectFor();
    if (id === null || this.decidingId() || this.note().trim().length === 0) return;

    const signup = this.signups().find((item) => item.tenant.id === id);
    this.decidingId.set(id);
    this.decisionErrorKey.set('');

    this.api.reject(id, this.note().trim()).subscribe({
      next: () => {
        this.decidingId.set(null);
        this.rejectFor.set(null);
        this.message.set(
          this.t('admin.signups.rejectedMsg', {
            company: signup?.tenant.companyName ?? '',
          }),
        );
        this.clearLater();
        this.load();
      },
      error: (error: unknown) => {
        this.decidingId.set(null);
        this.decisionErrorKey.set(this.decisionError(error));
      },
    });
  }

  cancelReject(): void {
    this.rejectFor.set(null);
    this.note.set('');
    this.decisionErrorKey.set('');
  }

  onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value.slice(0, 500));
  }

  planName(planId: string): string {
    return getPlanById(planId).name;
  }

  flagOf(country: string): string {
    return FLAGS[country] ?? '🌐';
  }

  docFor(signup: SignupReview, slot: string): SignupReviewDocument | undefined {
    return signup.documents.find((document) => document.slot === slot);
  }

  docIcon(slot: string): string {
    return DOC_ICONS[slot] ?? '📄';
  }

  openDocViewer(signup: SignupReview, slot: string): void {
    const doc = this.docFor(signup, slot);
    if (!doc) return;

    this.revokeDocUrl();
    this.viewer.set({ signup, doc });
    this.docLoading.set(true);
    this.docErrorKey.set('');

    this.api.download(signup.tenant.id, doc.id).subscribe({
      next: (blob) => {
        this.docObjectUrl = URL.createObjectURL(blob);
        this.docUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.docObjectUrl));
        this.docLoading.set(false);
      },
      error: () => {
        this.docLoading.set(false);
        this.docErrorKey.set('admin.signups.docViewer.error');
      },
    });
  }

  closeDocViewer(): void {
    this.revokeDocUrl();
    this.viewer.set(null);
  }

  isPdf(): boolean {
    return this.viewer()?.doc.contentType === 'application/pdf';
  }

  statusKey(status: string): string {
    return status.toLowerCase();
  }

  statusClass(status: string): string {
    if (status === 'APPROVED') return 'status-approved';
    if (status === 'REJECTED') return 'status-rejected';
    return 'status-waiting';
  }

  private revokeDocUrl(): void {
    if (this.docObjectUrl) {
      URL.revokeObjectURL(this.docObjectUrl);
      this.docObjectUrl = null;
    }
    this.docUrl.set(null);
    this.docErrorKey.set('');
  }

  private decisionError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = String(error.error?.message ?? '').toLowerCase();
      if (message.includes('payment required')) {
        return 'admin.signups.errors.paymentRequired';
      }
      if (message.includes('not found')) {
        return 'admin.signups.errors.notFound';
      }
    }
    return 'admin.signups.errors.decision';
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.transloco.translate(key, params);
  }

  /** Auto-clears the transient confirmation message. */
  private clearLater(): void {
    setTimeout(() => this.message.set(''), 3000);
  }
}
