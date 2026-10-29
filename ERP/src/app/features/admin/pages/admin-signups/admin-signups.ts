import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PlatformService } from '../../services/platform.service';
import { KycDocument, SignupRequest } from '../../models/platform';
import { getPlanById } from '../../../../core/data/plans';

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

/** Icon displayed on the simulated scan of each KYC document type. */
const DOC_ICONS: Record<string, string> = {
  idCard: '🪪',
  tradeRegister: '🏛️',
  taxRegistration: '🧮',
};

@Component({
  selector: 'app-admin-signups',
  imports: [DatePipe, TranslocoDirective],
  templateUrl: './admin-signups.html',
  styleUrl: './admin-signups.css',
})
export class AdminSignups {
  private readonly platformService = inject(PlatformService);
  private readonly transloco = inject(TranslocoService);

  /** The three simulated KYC documents of the registration form. */
  readonly documentKeys = ['idCard', 'tradeRegister', 'taxRegistration'] as const;

  signups = signal<SignupRequest[]>([]);
  loading = signal(true);
  decidingId = signal<number | null>(null);
  rejectFor = signal<number | null>(null);
  note = signal('');
  message = signal('');

  /** Open KYC document viewer: the clicked badge of the clicked request. */
  viewer = signal<{ signup: SignupRequest; doc: string } | null>(null);

  pendingCount = computed(
    () => this.signups().filter((s) => s.status === 'pending').length,
  );
  approvedCount = computed(
    () => this.signups().filter((s) => s.status === 'approved').length,
  );
  rejectedCount = computed(
    () => this.signups().filter((s) => s.status === 'rejected').length,
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.platformService.getSignups().subscribe((signups) => {
      this.signups.set(signups);
      this.loading.set(false);
    });
  }

  approve(signup: SignupRequest): void {
    this.decidingId.set(signup.id);
    this.platformService.approveSignup(signup.id).subscribe((approved) => {
      this.decidingId.set(null);
      if (approved) {
        this.signups.update((list) =>
          list.map((s) => (s.id === approved.id ? approved : s)),
        );
        this.message.set(
          this.t('admin.signups.approvedMsg', { company: approved.companyName }),
        );
        this.clearLater();
      }
    });
  }

  askReject(signup: SignupRequest): void {
    this.rejectFor.set(signup.id);
    this.note.set('');
    this.message.set('');
  }

  reject(): void {
    const id = this.rejectFor();
    if (id === null) return;
    this.decidingId.set(id);
    this.platformService.rejectSignup(id, this.note()).subscribe((rejected) => {
      this.decidingId.set(null);
      this.rejectFor.set(null);
      if (rejected) {
        this.signups.update((list) =>
          list.map((s) => (s.id === rejected.id ? rejected : s)),
        );
        this.message.set(
          this.t('admin.signups.rejectedMsg', { company: rejected.companyName }),
        );
        this.clearLater();
      }
    });
  }

  cancelReject(): void {
    this.rejectFor.set(null);
    this.note.set('');
  }

  onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLInputElement).value);
  }

  planName(signup: SignupRequest): string {
    return getPlanById(signup.planId).name;
  }

  flagOf(country: string): string {
    return FLAGS[country] ?? '🌐';
  }

  openDocViewer(signup: SignupRequest, doc: string): void {
    this.viewer.set({ signup, doc });
  }

  closeDocViewer(): void {
    this.viewer.set(null);
  }

  docIcon(doc: string): string {
    return DOC_ICONS[doc] ?? '📄';
  }

  /** The document record of the open viewer slot (undefined when unknown). */
  docEntry(view: { signup: SignupRequest; doc: string }): KycDocument | undefined {
    return view.signup.documents[view.doc as 'idCard' | 'tradeRegister' | 'taxRegistration'];
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    return 'status-waiting';
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.transloco.translate(key, params);
  }

  private clearLater(): void {
    setTimeout(() => this.message.set(''), 3000);
  }
}
