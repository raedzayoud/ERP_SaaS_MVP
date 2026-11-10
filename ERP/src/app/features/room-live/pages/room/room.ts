import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { ChatMessage, Room, RoomAttachment, RoomParticipant, RoomParticipantRole } from '../../models/room';
import { RoomLiveService } from '../../services/room-live.service';
import { MediaStage } from '../../components/media-stage/media-stage';

@Component({
  selector: 'app-room',
  imports: [DatePipe, RouterLink, TranslocoDirective, MediaStage],
  templateUrl: './room.html',
  styleUrl: './room.css',
})
export class RoomPage {
  private readonly service = inject(RoomLiveService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  readonly roomId = signal(0);
  readonly room = signal<Room | null>(null);
  readonly notFound = signal(false);
  readonly draft = signal('');

  readonly workspaceUsers = this.service.workspaceUsers;
  readonly currentUserId = computed(() => {
    const id = this.authService.currentUser()?.id;
    return typeof id === 'number' ? id : 0;
  });

  /** R5 moderation: the owner manages roles, kicks, blocks and host transfer. */
  readonly ROLE_OPTIONS: RoomParticipantRole[] = ['host', 'participant', 'viewer'];
  readonly inviteUserId = signal(0);
  readonly invitableUsers = computed(() => {
    const room = this.room();
    if (!room) return [];
    return this.workspaceUsers().filter(
      (user) =>
        user.id !== this.currentUserId() &&
        !room.participants.some((p) => p.userId === user.id) &&
        !room.blockedUserIds.includes(user.id),
    );
  });
  readonly blockedNames = computed(() =>
    (this.room()?.blockedUserIds ?? []).map((id) => this.nameOf(id)),
  );

  readonly state = computed<'notFound' | 'locked' | 'archived' | 'open'>(() => {
    const room = this.room();
    if (!room) return 'notFound';
    if (!this.service.canAccess(room, this.currentUserId())) return 'locked';
    if (room.status === 'archived') return 'archived';
    return 'open';
  });

  readonly participants = computed<RoomParticipant[]>(
    () => this.room()?.participants ?? [],
  );
  readonly messages = computed<ChatMessage[]>(() => this.room()?.messages ?? []);

  readonly pendingAttachment = signal<{
    id: string;
    fileName: string;
    sizeKb: number;
  } | null>(null);
  readonly attachError = signal<string | null>(null);

  readonly attachmentsById = computed<Map<string, RoomAttachment>>(() => {
    const map = new Map<string, RoomAttachment>();
    for (const attachment of this.room()?.attachments ?? []) {
      map.set(attachment.id, attachment);
    }
    return map;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isFinite(id)) return;
      this.roomId.set(id);
      this.openRoom(id);
    });
  }

  /** Keeps the newest chat message in view as the conversation grows. */
  private readonly chatFeed = viewChild<ElementRef<HTMLElement>>('chatFeed');
  private readonly scrollFeedEffect = effect(() => {
    this.messages();
    const feed = this.chatFeed()?.nativeElement;
    if (!feed) return;
    requestAnimationFrame(() => {
      feed.scrollTop = feed.scrollHeight;
    });
  });

  nameOf(userId: number): string {
    return this.workspaceUsers().find((user) => user.id === userId)?.name ?? '—';
  }

  roleOf(room: Room, userId: number): string | undefined {
    return this.service.participantRole(room, userId);
  }

  isMe(userId: number): boolean {
    return userId === this.currentUserId();
  }

  isOwner(): boolean {
    const room = this.room();
    return room !== null && this.service.isOwner(room, this.currentUserId());
  }

  isMember(): boolean {
    const room = this.room();
    return (
      room !== null &&
      this.service.participantOf(room, this.currentUserId()) !== undefined
    );
  }

  canPost(): boolean {
    const room = this.room();
    return room !== null && this.service.canPost(room, this.currentUserId());
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
  }

  onFilePick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.attachError.set(null);
    this.service.attachFile(this.roomId(), file).then((attachment) => {
      if (!attachment) {
        this.attachError.set('roomlive.files.errors.invalid');
        return;
      }
      this.pendingAttachment.set({
        id: attachment.id,
        fileName: attachment.fileName,
        sizeKb: attachment.sizeKb,
      });
      input.value = '';
    });
  }

  removePending(): void {
    this.pendingAttachment.set(null);
  }

  sendMessage(): void {
    if (!this.canPost()) return;
    const text = this.draft().trim();
    const attachment = this.pendingAttachment();
    if (!text && !attachment) return;
    this.service.postMessage(this.roomId(), text, attachment?.id ?? undefined);
    this.draft.set('');
    this.pendingAttachment.set(null);
    this.room.set(this.service.getRoom(this.roomId()) ?? null);
  }

  removeAttachment(messageId: string, attachmentId: string): void {
    const room = this.room();
    if (!room) return;
    const ok = this.service.removeAttachment(room.id, attachmentId);
    if (!ok) return;
    this.room.set(this.service.getRoom(room.id) ?? null);
  }

  canRemoveAttachment(authorUserId: number): boolean {
    const room = this.room();
    return room !== null && (this.isOwner() || authorUserId === this.currentUserId());
  }

  joinRoom(): void {
    this.service.join(this.roomId());
    this.room.set(this.service.getRoom(this.roomId()) ?? null);
  }

  leaveRoom(): void {
    this.service.leave(this.roomId());
    this.room.set(this.service.getRoom(this.roomId()) ?? null);
  }

  private refreshRoom(): void {
    this.room.set(this.service.getRoom(this.roomId()) ?? null);
  }

  /** Private 1-to-1 thread with another member (opened from ✉ in the panel). */
  readonly dmPeerId = signal<number | null>(null);
  readonly dmDraft = signal('');
  readonly dmThread = computed(() => {
    const peer = this.dmPeerId();
    if (!peer) return undefined;
    return this.service.dmWith(this.roomId(), this.currentUserId(), peer);
  });

  openPeerDm(userId: number): void {
    this.dmPeerId.set(userId);
    this.dmDraft.set('');
  }

  closeDm(): void {
    this.dmPeerId.set(null);
  }

  onDmDraftInput(value: string): void {
    this.dmDraft.set(value);
  }

  sendPeerDm(): void {
    const peer = this.dmPeerId();
    const text = this.dmDraft().trim();
    if (!peer || !text) return;
    if (this.service.sendDm(this.roomId(), peer, text)) {
      this.dmDraft.set('');
    }
  }

  onInviteSelect(value: string): void {
    this.inviteUserId.set(Number(value) || 0);
  }

  inviteSelected(): void {
    const id = this.inviteUserId();
    if (!id || !this.isOwner()) return;
    this.service.invite(this.roomId(), id);
    this.inviteUserId.set(0);
    this.refreshRoom();
  }

  onRoleChange(userId: number, role: string): void {
    if (!this.isOwner()) return;
    if (role === 'host') {
      this.service.transferHost(this.roomId(), userId);
    } else if (role === 'participant' || role === 'viewer') {
      this.service.setRole(this.roomId(), userId, role);
    }
    this.refreshRoom();
  }

  kickParticipant(userId: number): void {
    this.service.kick(this.roomId(), userId);
    this.refreshRoom();
  }

  blockParticipant(userId: number): void {
    this.service.block(this.roomId(), userId);
    this.refreshRoom();
  }

  reopenRoom(): void {
    this.service.reopen(this.roomId());
    this.room.set(this.service.getRoom(this.roomId()) ?? null);
  }

  backToList(): void {
    this.router.navigate(['/rooms']);
  }

  private openRoom(id: number): void {
    const room = this.service.getRoom(id);
    if (!room) {
      this.notFound.set(true);
      this.room.set(null);
      return;
    }
    this.notFound.set(false);
    // A visitor of an open room joins automatically so the chat is usable.
    if (this.service.canAccess(room, this.currentUserId())) {
      this.service.join(id);
    }
    this.room.set(this.service.getRoom(id) ?? null);
  }
}
