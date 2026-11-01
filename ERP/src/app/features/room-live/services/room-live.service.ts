import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { safeStorage } from '../../../core/utils/safe-storage';
import {
  Room,
  RoomAttachment,
  RoomCreateInput,
  RoomDm,
  RoomDmMessage,
  RoomParticipant,
  RoomParticipantRole,
} from '../models/room';

const MAX_ATTACHMENT_KB = 2048;
const PREVIEW_KB = 300;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
];

const ROOMS_KEY = 'roomlive_rooms';

function loadRooms(): Room[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ROOMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Room[]) : [];
  } catch {
    return [];
  }
}

function saveRooms(rooms: Room[]): void {
  try {
    safeStorage()?.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    // mock app: ignore storage issues
  }
}

const DMS_KEY = 'roomlive_dms';

function loadDms(): RoomDm[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(DMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RoomDm[]) : [];
  } catch {
    return [];
  }
}

function saveDms(dms: RoomDm[]): void {
  try {
    safeStorage()?.setItem(DMS_KEY, JSON.stringify(dms));
  } catch {
    // mock app: ignore storage issues
  }
}

/** Kept sorted so a thread stays the same one whatever user opens it. */
function dmPair(x: number, y: number): [number, number] {
  return x <= y ? [x, y] : [y, x];
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedRooms(): Room[] {
  const base = nowIso();
  return [
    {
      id: 1,
      title: 'Sales weekly meeting',
      access: 'members',
      status: 'active',
      ownerUserId: 1,
      participants: [
        { userId: 1, role: 'host', joinedAt: base },
        { userId: 2, role: 'participant', joinedAt: base },
        { userId: 3, role: 'participant', joinedAt: base },
      ],
      blockedUserIds: [],
      messages: [
        {
          id: 'm1',
          authorUserId: 1,
          text: 'Agenda for today: pipeline review and the new quote for Oasis.',
          createdAt: base,
        },
        {
          id: 'm2',
          authorUserId: 2,
          text: 'I uploaded the Oasis quotation draft in the shared folder.',
          createdAt: base,
        },
      ],
      events: [{ id: 'e1', kind: 'created', at: base, actorUserId: 1 }],
      createdAt: base,
    },
    {
      id: 2,
      title: 'Support invoice FA-2026-031',
      access: 'invite-only',
      status: 'active',
      ownerUserId: 1,
      participants: [
        { userId: 1, role: 'host', joinedAt: base },
        { userId: 6, role: 'viewer', joinedAt: base },
      ],
      blockedUserIds: [],
      messages: [
        {
          id: 'm3',
          authorUserId: 6,
          text: 'The client disputes the delivery date mentioned on the invoice.',
          createdAt: base,
        },
      ],
      events: [{ id: 'e2', kind: 'created', at: base, actorUserId: 1 }],
      linkedDocRef: 'FA-2026-031',
      createdAt: base,
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class RoomLiveService {
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  readonly rooms = signal<Room[]>(this.loadOrSeed());

  /** Private 1-to-1 threads, persisted separately from the rooms. */
  readonly dms = signal<RoomDm[]>(loadDms());

  /** User of the open workspace, or an anonymous fallback for tests. */
  private currentUserId(): number {
    return this.authService.currentUser()?.id ?? 0;
  }

  private loadOrSeed(): Room[] {
    const stored = loadRooms();
    if (stored.length > 0) return stored;
    const seeded = seedRooms();
    saveRooms(seeded);
    return seeded;
  }

  /** Rooms the current user can open (members rooms or invited rooms). */
  readonly myRooms = computed<Room[]>(() => {
    const userId = this.currentUserId();
    return this.rooms().filter((room) => this.canAccess(room, userId));
  });

  /** Members of the workspace that can be invited. */
  readonly workspaceUsers = computed(
    () => this.tenantService.currentTenant()?.users ?? [],
  );

  getRooms(): Room[] {
    return this.rooms();
  }

  getRoom(id: number): Room | undefined {
    return this.rooms().find((room) => room.id === id);
  }

  participantOf(room: Room, userId: number) {
    return room.participants.find((p) => p.userId === userId);
  }

  participantRole(room: Room, userId: number): RoomParticipantRole | undefined {
    return this.participantOf(room, userId)?.role;
  }

  /** Owner keeps full control; host is also the room owner in this mock. */
  isOwner(room: Room, userId: number): boolean {
    return room.ownerUserId === userId;
  }

  /** Members rooms are open to every workspace user, invite-only to invited ones. */
  canAccess(room: Room, userId: number): boolean {
    if (userId <= 0) return false;
    if (room.access === 'members') return true;
    return this.participantOf(room, userId) !== undefined;
  }

  canPost(room: Room, userId: number): boolean {
    if (room.status !== 'active') return false;
    if (this.participantRole(room, userId) === 'viewer') return false;
    return this.canAccess(room, userId);
  }

  createRoom(input: RoomCreateInput): Room {
    const userId = this.currentUserId();
    const base = nowIso();
    const invited = (input.invitedUserIds ?? [])
      .filter((id) => id !== userId)
      .map(
        (id) =>
          ({
            userId: id,
            role: 'participant' as RoomParticipantRole,
            joinedAt: base,
          }) as const,
      );

    const room: Room = {
      id: Math.max(0, ...this.rooms().map((r) => r.id)) + 1,
      title: input.title,
      access: input.access,
      status: 'active',
      ownerUserId: userId,
      participants: [{ userId, role: 'host', joinedAt: base }, ...invited],
      blockedUserIds: [],
      messages: [],
      events: [
        { id: `e-${base}`, kind: 'created', at: base, actorUserId: userId },
      ],
      linkedDocRef: input.linkedDocRef?.trim() || undefined,
      createdAt: base,
    };

    this.rooms.update((list) => [...list, room]);
    saveRooms(this.rooms());
    return room;
  }

  /** Current user joins a room (never after being blocked). */
  join(roomId: number): Room | undefined {
    const userId = this.currentUserId();
    return this.joinAs(roomId, userId);
  }

  joinAs(roomId: number, userId: number): Room | undefined {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'active') return undefined;
    if (room.blockedUserIds.includes(userId)) return undefined;
    if (!this.canAccess(room, userId)) return undefined;
    if (this.participantOf(room, userId)) return room;

    const base = nowIso();
    const participant: RoomParticipant = {
      userId,
      role: room.ownerUserId === userId ? 'host' : 'participant',
      joinedAt: base,
    };
    this.updateRoom(room.id, {
      participants: [...room.participants, participant],
      events: [...room.events, { id: `e-${base}`, kind: 'joined', at: base, actorUserId: userId }],
    });
    return this.getRoom(roomId);
  }

  /** Leaves the room (the owner cannot leave its own room). */
  leave(roomId: number): void {
    const userId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || this.isOwner(room, userId)) return;
    this.updateRoom(roomId, {
      participants: room.participants.filter((p) => p.userId !== userId),
    });
  }

  postMessage(roomId: number, text: string, attachmentId?: string): void {
    const room = this.getRoom(roomId);
    const userId = this.currentUserId();
    if (!room || !this.canPost(room, userId)) return;

    const trimmed = text.trim();
    if (!trimmed && !attachmentId) return;

    const message = {
      id: `m-${nowIso()}`,
      authorUserId: userId,
      text: trimmed,
      createdAt: nowIso(),
      ...(attachmentId ? { attachmentId } : {}),
    };
    this.updateRoom(roomId, {
      messages: [...room.messages, message],
    });
  }

  /**
   * Attaches a file to a room chat.
   * Returns the saved attachment, or null when limits/type rules are violated.
   * Small previews are kept for images (and tiny PDFs) so the room can show them.
   */
  async attachFile(roomId: number, file: File): Promise<RoomAttachment | null> {
    const room = this.getRoom(roomId);
    const userId = this.currentUserId();
    if (!room || !this.canPost(room, userId)) return null;
    if (file.size > MAX_ATTACHMENT_KB * 1024) return null;
    if (!ACCEPTED_TYPES.includes(file.type)) return null;

    let dataUrl: string | undefined;
    const sizeKb = Math.round(file.size / 1024);
    if (file.type.startsWith('image/') && sizeKb <= PREVIEW_KB) {
      dataUrl = await readFileAsDataUrl(file);
    }

    const attachment: RoomAttachment = {
      id: `att-${nowIso()}`,
      fileName: file.name,
      sizeKb,
      authorUserId: userId,
      createdAt: nowIso(),
      ...(dataUrl ? { dataUrl } : {}),
    };

    this.updateRoom(roomId, {
      attachments: [...(room.attachments ?? []), attachment],
      messages: [
        ...room.messages,
        {
          id: `m-${nowIso()}`,
          authorUserId: userId,
          text: '',
          createdAt: nowIso(),
          attachmentId: attachment.id,
        },
      ],
    });
    return attachment;
  }

  /** Removes an attachment: author of the file or room host only. */
  removeAttachment(roomId: number, attachmentId: string): boolean {
    const actorId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'active') return false;

    const attachment = room.attachments?.find((a) => a.id === attachmentId);
    if (!attachment) return false;
    if (actorId !== attachment.authorUserId && actorId !== room.ownerUserId) {
      return false;
    }

    this.updateRoom(roomId, {
      attachments: (room.attachments ?? []).filter((a) => a.id !== attachmentId),
    });
    return true;
  }

  /** Invites a workspace member into an invite-only room (prevents blocked ids). */
  invite(roomId: number, userId: number): boolean {
    const actorId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'active') return false;
    if (room.blockedUserIds.includes(userId)) return false;
    if (this.participantOf(room, userId)) return false;
    if (!this.isOwner(room, actorId)) return false;

    const base = nowIso();
    this.updateRoom(roomId, {
      participants: [
        ...room.participants,
        { userId, role: 'participant' as RoomParticipantRole, joinedAt: base },
      ],
      events: [
        ...room.events,
        { id: `e-${base}`, kind: 'invite', at: base, actorUserId: actorId, targetUserId: userId },
      ],
    });
    return true;
  }

  /** Removes a participant from the room (owner only). */
  kick(roomId: number, userId: number): boolean {
    const actorId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || !this.isOwner(room, actorId)) return false;
    if (this.isOwner(room, userId)) return false;

    const base = nowIso();
    this.updateRoom(roomId, {
      participants: room.participants.filter((p) => p.userId !== userId),
      events: [
        ...room.events,
        { id: `e-${base}`, kind: 'kick', at: base, actorUserId: actorId, targetUserId: userId },
      ],
    });
    return true;
  }

  /** Blocks a user: they can never re-enter the room. */
  block(roomId: number, userId: number): boolean {
    const kicked = this.kick(roomId, userId);
    if (!kicked) return false;
    const room = this.getRoom(roomId)!;
    const base = nowIso();
    this.updateRoom(roomId, {
      blockedUserIds: [...room.blockedUserIds, userId],
      events: [
        ...room.events,
        { id: `e-${base}`, kind: 'block', at: base, actorUserId: this.currentUserId(), targetUserId: userId },
      ],
    });
    return true;
  }

  /** Changes the role of a participant (owner only). */
  setRole(roomId: number, userId: number, role: RoomParticipantRole): boolean {
    const actorId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || !this.isOwner(room, actorId)) return false;
    if (this.isOwner(room, userId)) return false;

    const base = nowIso();
    this.updateRoom(roomId, {
      participants: room.participants.map((p) =>
        p.userId === userId ? { ...p, role } : p,
      ),
      events: [
        ...room.events,
        {
          id: `e-${base}`,
          kind: 'role',
          at: base,
          actorUserId: actorId,
          targetUserId: userId,
          role,
        },
      ],
    });
    return true;
  }

  /** Passes the host seat to another participant (owner only). */
  transferHost(roomId: number, userId: number): boolean {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'active') return false;
    if (!this.isOwner(room, this.currentUserId())) return false;
    const participant = room.participants.find((p) => p.userId === userId);
    if (!participant || userId === room.ownerUserId) return false;

    const base = nowIso();
    this.updateRoom(roomId, {
      ownerUserId: userId,
      participants: room.participants.map((p) =>
        p.userId === userId
          ? { ...p, role: 'host' as RoomParticipantRole }
          : p.userId === room.ownerUserId
            ? { ...p, role: 'participant' as RoomParticipantRole }
            : p,
      ),
      events: [
        ...room.events,
        {
          id: `e-${base}`,
          kind: 'role',
          at: base,
          actorUserId: this.currentUserId(),
          targetUserId: userId,
          role: 'host',
        },
      ],
    });
    return true;
  }

  /** Archives a room: read-only from now on (owner only). */
  archive(roomId: number): boolean {
    const actorId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || !this.isOwner(room, actorId) || room.status === 'archived') {
      return false;
    }
    const base = nowIso();
    this.updateRoom(roomId, { status: 'archived', endedAt: base });
    return true;
  }

  /** Re-opens an archived room (owner only). */
  reopen(roomId: number): boolean {
    const room = this.getRoom(roomId);
    if (!room || !this.isOwner(room, this.currentUserId())) return false;
    this.updateRoom(roomId, { status: 'active', endedAt: undefined });
    return true;
  }

  /** All private threads of a user inside one room. */
  listDms(roomId: number, meId: number): RoomDm[] {
    return this.dms().filter(
      (dm) => dm.roomId === roomId && (dm.aUserId === meId || dm.bUserId === meId),
    );
  }

  /** The private thread between two members, undefined when they never wrote yet. */
  dmWith(roomId: number, meId: number, peerId: number): RoomDm | undefined {
    const [a, b] = dmPair(meId, peerId);
    return this.dms().find((dm) => dm.roomId === roomId && dm.aUserId === a && dm.bUserId === b);
  }

  /** Sends a private message: both users must be participants of an active room. */
  sendDm(roomId: number, peerId: number, text: string): boolean {
    const meId = this.currentUserId();
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'active') return false;
    if (meId <= 0 || peerId <= 0 || peerId === meId) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (this.participantOf(room, meId) === undefined) return false;
    if (this.participantOf(room, peerId) === undefined) return false;

    const [a, b] = dmPair(meId, peerId);
    const thread = this.dmWith(roomId, meId, peerId);
    const message: RoomDmMessage = {
      id: `dm-${nowIso()}-${Math.random().toString(36).slice(2, 6)}`,
      fromUserId: meId,
      toUserId: peerId,
      text: trimmed,
      createdAt: nowIso(),
    };
    this.dms.update((list) =>
      thread
        ? list.map((item) =>
            item === thread ? { ...item, messages: [...item.messages, message] } : item,
          )
        : [...list, { roomId, aUserId: a, bUserId: b, messages: [message] }],
    );
    saveDms(this.dms());
    return true;
  }

  private updateRoom(id: number, patch: Partial<Room>): void {
    this.rooms.update((list) =>
      list.map((room) => (room.id === id ? { ...room, ...patch } : room)),
    );
    saveRooms(this.rooms());
  }
}
