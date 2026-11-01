/** Roles inside a live room. */
export type RoomParticipantRole = 'host' | 'participant' | 'viewer';

/** A room is either open to every workspace member or invite-only. */
export type RoomAccess = 'members' | 'invite-only';

/** Active rooms accept new messages; archived rooms are read-only. */
export type RoomStatus = 'active' | 'archived';

export interface RoomParticipant {
  userId: number;
  role: RoomParticipantRole;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  authorUserId: number;
  text: string;
  createdAt: string;
  /** Set when the message carries an attachment (filled from R4). */
  attachmentId?: string;
}

/** Rooms keep an ordered activity log, shown as a timeline. */
export type RoomEventKind =
  | 'created'
  | 'invite'
  | 'kick'
  | 'block'
  | 'role'
  | 'leave'
  | 'joined'
  | 'summary';

export interface RoomEvent {
  id: string;
  kind: RoomEventKind;
  at: string;
  actorUserId: number;
  /** Optional participant the event is about (invite, kick, role change). */
  targetUserId?: number;
  /** For role changes: the new role. */
  role?: RoomParticipantRole;
}

/** Files shared in a room chat (metadata + small preview, like the KYC uploads). */
export interface RoomAttachment {
  id: string;
  fileName: string;
  sizeKb: number;
  authorUserId: number;
  createdAt: string;
  /** Small base64 preview (images up to PREVIEW_KB, any file up to the room limit). */
  dataUrl?: string;
}

export const ROOM_MAX_ATTACHMENT_KB = 2048;

export interface Room {
  id: number;
  title: string;
  access: RoomAccess;
  status: RoomStatus;
  /** The creator keeps the host seat. */
  ownerUserId: number;
  participants: RoomParticipant[];
  /** Blocked users cannot re-enter the room. */
  blockedUserIds: number[];
  messages: ChatMessage[];
  events: RoomEvent[];
  /** Optional ERP document the room is about (e.g. "FA-2026-031"). */
  linkedDocRef?: string;
  /** Shared files (filled from R4). */
  attachments?: RoomAttachment[];
  createdAt: string;
  endedAt?: string;
}

/** Input of createRoom(). */
export interface RoomCreateInput {
  title: string;
  access: RoomAccess;
  invitedUserIds?: number[];
  linkedDocRef?: string;
}

export const ROOM_ACCESS: RoomAccess[] = ['members', 'invite-only'];

/** One line of the private 1-to-1 chat between two members of a room. */
export interface RoomDmMessage {
  id: string;
  fromUserId: number;
  toUserId: number;
  text: string;
  createdAt: string;
}

/** Private thread between two room members (aUserId/bUserId stay sorted ascending). */
export interface RoomDm {
  roomId: number;
  aUserId: number;
  bUserId: number;
  messages: RoomDmMessage[];
}
