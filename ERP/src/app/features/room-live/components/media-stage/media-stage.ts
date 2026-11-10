import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { RoomLiveService } from '../../services/room-live.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-media-stage',
  imports: [TranslocoDirective],
  templateUrl: './media-stage.html',
  styleUrl: './media-stage.css',
})
export class MediaStage implements OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly service = inject(RoomLiveService);
  private readonly authService = inject(AuthService);

  /** Not "required": the video tag only exists while the session is on. */
  readonly localVideo = viewChild<ElementRef<HTMLVideoElement>>('localVideo');

  readonly mediaSupported = computed(() => {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as unknown as { mediaDevices?: unknown };
    return nav.mediaDevices !== undefined;
  });

  readonly sessionOn = signal(false);
  readonly camOn = signal(false);
  readonly micOn = signal(false);
  readonly screening = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly participants = this.service.workspaceUsers;
  readonly currentUserId = computed(() => {
    const id = this.authService.currentUser()?.id;
    return typeof id === 'number' ? id : 0;
  });

  /** Local camera/mic/screen stream. A signal so the effect below can attach it to the <video>. */
  private readonly localStream = signal<MediaStream | null>(null);

  /** Copies the stream into the <video> element whenever either changes. */
  private readonly attachVideoEffect = effect(() => {
    const stream = this.localStream();
    const video = this.localVideo();
    if (stream && video && video.nativeElement) {
      video.nativeElement.srcObject = stream;
    }
  });

  async startSession(): Promise<void> {
    if (!this.mediaSupported()) {
      this.errorKey.set('roomlive.media.errors.unsupported');
      return;
    }
    const previous = this.localStream();
    previous?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices!.getUserMedia({ audio: true, video: true });
      this.localStream.set(stream);
      this.sessionOn.set(true);
      this.camOn.set(true);
      this.micOn.set(true);
      this.screening.set(false);
      this.errorKey.set(null);
    } catch {
      this.errorKey.set('roomlive.media.errors.denied');
    }
  }

  async stopSession(): Promise<void> {
    const stream = this.localStream();
    stream?.getTracks().forEach((track) => track.stop());
    this.localStream.set(null);
    this.sessionOn.set(false);
    this.camOn.set(false);
    this.micOn.set(false);
    this.screening.set(false);
  }

  toggleMic(): void {
    const on = !this.micOn();
    const stream = this.localStream();
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = on;
      });
    }
    this.micOn.set(on);
  }

  toggleCamera(): void {
    const on = !this.camOn();
    const stream = this.localStream();
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = on;
      });
    }
    this.camOn.set(on);
  }

  async shareScreen(): Promise<void> {
    if (!this.mediaSupported()) {
      this.errorKey.set('roomlive.media.errors.unsupported');
      return;
    }
    const previous = this.localStream();
    previous?.getTracks().forEach((track) => track.stop());
    try {
      const display = await navigator.mediaDevices!.getDisplayMedia({ video: true });
      this.localStream.set(display);
      this.screening.set(true);
      this.camOn.set(false);
      display.getVideoTracks()[0]?.addEventListener('ended', () => void this.stopScreen());
    } catch {
      this.errorKey.set('roomlive.media.errors.denied');
    }
  }

  async stopScreen(): Promise<void> {
    const stream = this.localStream();
    stream?.getTracks().forEach((track) => track.stop());
    this.localStream.set(null);
    this.screening.set(false);
    this.camOn.set(false);
    this.micOn.set(false);
    this.sessionOn.set(false);
  }

  protected t(key: string): string {
    return this.transloco.translate(key);
  }

  nameOf(userId: number): string {
    return this.service.workspaceUsers().find((u) => u.id === userId)?.name ?? String(userId);
  }

  initials(name: string): string {
    return name.split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  ngOnDestroy(): void {
    void this.stopSession();
  }
}
