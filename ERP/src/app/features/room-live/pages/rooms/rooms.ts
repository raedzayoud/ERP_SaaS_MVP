import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Room, RoomAccess } from '../../models/room';
import { RoomLiveService } from '../../services/room-live.service';
import { TenantUser } from '../../../../core/models/tenant';

@Component({
  selector: 'app-rooms',
  imports: [DatePipe, FormsModule, RouterLink, TranslocoDirective],
  templateUrl: './rooms.html',
  styleUrl: './rooms.css',
})
export class Rooms {
  private readonly service = inject(RoomLiveService);
  private readonly router = inject(Router);

  readonly roomAccess: RoomAccess[] = ['members', 'invite-only'];

  search = signal('');
  showCreate = signal(false);

  newTitle = signal('');
  newAccess = signal<RoomAccess>('members');
  newLinkedDoc = signal('');
  newInvited = signal<number[]>([]);
  createError = signal('');

  readonly workspaceUsers: TenantUser[] = this.service.workspaceUsers();

  readonly rooms = computed<Room[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.service.myRooms();
    if (!term) return list;
    return list.filter(
      (room) =>
        room.title.toLowerCase().includes(term) ||
        (room.linkedDocRef ?? '').toLowerCase().includes(term),
    );
  });

  lastMessageOf(room: Room): string | undefined {
    return room.messages[room.messages.length - 1]?.text;
  }

  lastActivityDate(room: Room): Date {
    return new Date(room.events[room.events.length - 1]?.at ?? room.createdAt);
  }

  memberCount(room: Room): number {
    return room.participants.length;
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  toggleCreate(): void {
    this.showCreate.update((visible) => !visible);
  }

  onAccessChoice(value: string): void {
    this.newAccess.set(value as RoomAccess);
  }

  onTitleInput(value: string): void {
    this.newTitle.set(value);
  }

  onLinkedDocInput(value: string): void {
    this.newLinkedDoc.set(value);
  }

  isInvited(userId: number): boolean {
    return this.newInvited().includes(userId);
  }

  toggleInvite(userId: number): void {
    this.newInvited.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  titleValid(): boolean {
    return this.newTitle().trim().length >= 3;
  }

  createRoom(): void {
    if (!this.titleValid()) {
      this.createError.set('roomlive.errors.titleLength');
      return;
    }
    this.createError.set('');
    const room = this.service.createRoom({
      title: this.newTitle().trim(),
      access: this.newAccess(),
      invitedUserIds: this.newInvited(),
      linkedDocRef: this.newLinkedDoc(),
    });

    this.newTitle.set('');
    this.newAccess.set('members');
    this.newLinkedDoc.set('');
    this.newInvited.set([]);
    this.showCreate.set(false);
    this.router.navigate(['/rooms', room.id]);
  }
}
