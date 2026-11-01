import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { User } from '../../../core/models/user';
import { RoomLiveService } from './room-live.service';
import { Room } from '../models/room';

const ADMIN: User = { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin-entreprise' };
const SALES: User = { id: 2, name: 'Sales', email: 'commercial@demo.com', role: 'commercial' };
const WIRM: User = { id: 3, name: 'Warda', email: 'magasinier@demo.com', role: 'magasinier' };

describe('RoomLiveService', () => {
  let service: RoomLiveService;
  let currentUser: User | null = ADMIN;

  beforeEach(() => {
    currentUser = ADMIN;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: () => currentUser } },
        {
          provide: TenantService,
          useValue: {
            currentTenant: () => ({
              id: 1,
              companyName: 'Demo SARL',
              users: [ADMIN, SALES, WIRM],
            }),
            enabledModules: () => ['collab'],
          },
        },
      ],
    });
    service = TestBed.inject(RoomLiveService);
  });

  /** Snapshot of one stored room (undefined when unknown). */
  const snap = (id: number): Room | undefined =>
    service.getRooms().find((room) => room.id === id);

  const asRoom = (room: Room | undefined): Room => {
    if (!room) throw new Error('room missing');
    return room;
  };

  it('seeds demo rooms for the first session', () => {
    const seeded = service.getRooms();
    expect(seeded.length).toBeGreaterThanOrEqual(2);
    const titles = seeded.map((room) => room.title);
    expect(titles).toContain('Sales weekly meeting');
    expect(seeded.some((room) => room.access === 'invite-only')).toBe(true);
  });

  it('creates a members room with the creator as host', () => {
    const room = service.createRoom({ title: 'Stock quick huddle', access: 'members' });
    const stored = asRoom(snap(room.id));
    expect(stored.title).toBe('Stock quick huddle');
    expect(stored.participants).toHaveLength(1);
    expect(stored.participants[0].role).toBe('host');
    expect(stored.status).toBe('active');
  });

  it('opens members rooms to everybody but keeps invite-only rooms locked', () => {
    const open = service.createRoom({ title: 'Open room', access: 'members' });
    currentUser = WIRM;
    expect(service.canAccess(asRoom(snap(open.id)), WIRM.id)).toBe(true);

    currentUser = ADMIN;
    const privy = service.createRoom({ title: 'Private room', access: 'invite-only' });
    expect(service.canAccess(asRoom(snap(privy.id)), WIRM.id)).toBe(false);

    service.invite(privy.id, WIRM.id);
    expect(service.canAccess(asRoom(snap(privy.id)), WIRM.id)).toBe(true);
  });

  it('publishes chat messages only from members, appending them to the room', () => {
    const created = service.createRoom({ title: 'Chat room', access: 'members' });
    const before = asRoom(snap(created.id)).messages.length;

    service.postMessage(created.id, 'Hello the team');
    const stored = asRoom(snap(created.id));
    expect(stored.messages.length).toBe(before + 1);
    expect(stored.messages[stored.messages.length - 1]?.text).toBe('Hello the team');
    expect(stored.messages[stored.messages.length - 1]?.authorUserId).toBe(ADMIN.id);
  });

  it('keeps observers out of the chat', () => {
    const room = service.createRoom({ title: 'Readonly room', access: 'members' });
    currentUser = WIRM;
    service.joinAs(room.id, WIRM.id);
    currentUser = ADMIN;
    service.setRole(room.id, WIRM.id, 'viewer');

    currentUser = WIRM;
    service.postMessage(room.id, 'invisible');
    const stored = asRoom(snap(room.id));
    expect(stored.messages.some((message) => message.text === 'invisible')).toBe(false);
  });

  it('blocks kicked users from joining an invite-only room again', () => {
    const room = service.createRoom({
      title: 'Private with sales',
      access: 'invite-only',
      invitedUserIds: [SALES.id],
    });
    expect(service.block(room.id, SALES.id)).toBe(true);
    expect(service.canAccess(asRoom(snap(room.id)), SALES.id)).toBe(false);
    expect(asRoom(snap(room.id)).blockedUserIds).toContain(SALES.id);
    expect(service.joinAs(room.id, SALES.id)).toBeUndefined();
  });

  it('archives rooms: writing stops until the owner reopens', () => {
    const room = service.createRoom({ title: 'Archive me', access: 'members' });
    expect(service.archive(room.id)).toBe(true);
    expect(asRoom(snap(room.id)).status).toBe('archived');

    service.postMessage(room.id, 'nope');
    expect(asRoom(snap(room.id)).messages.some((m) => m.text === 'nope')).toBe(false);

    expect(service.reopen(room.id)).toBe(true);
    expect(asRoom(snap(room.id)).status).toBe('active');
  });

  it('attaches allowed files to the chat and rejects big or wrong files', async () => {
    const room = service.createRoom({ title: 'Files room', access: 'members' });

    const pdf = new File([new Uint8Array(150)], 'quote.pdf', { type: 'application/pdf' });
    const saved = await service.attachFile(room.id, pdf);
    expect(saved).not.toBeNull();

    const stored = asRoom(snap(room.id));
    expect(stored.attachments).toHaveLength(1);
    expect(saved?.fileName).toBe('quote.pdf');
    expect(saved?.dataUrl).toBeUndefined();
    expect(stored.messages[stored.messages.length - 1]?.attachmentId).toBe(saved?.id);

    const heavy = new File([new Uint8Array(3 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect(await service.attachFile(room.id, heavy)).toBeNull();
    const bad = new File([new Uint8Array(10)], 'virus.exe', {
      type: 'application/octet-stream',
    });
    expect(await service.attachFile(room.id, bad)).toBeNull();
    expect(asRoom(snap(room.id)).attachments).toHaveLength(1);
  });

  it('lets the author or the host remove an attachment, not other members', async () => {
    const room = service.createRoom({ title: 'Cleanup room', access: 'members' });
    const pdf = new File([new Uint8Array(150)], 'note.pdf', { type: 'application/pdf' });
    const saved = await service.attachFile(room.id, pdf);
    if (!saved) throw new Error('attachment expected');

    currentUser = WIRM;
    service.joinAs(room.id, WIRM.id);
    expect(service.removeAttachment(room.id, saved.id)).toBe(false);

    currentUser = ADMIN;
    expect(service.removeAttachment(room.id, saved.id)).toBe(true);
    expect(asRoom(snap(room.id)).attachments).toHaveLength(0);
    // The message keeps its attachmentId so the chat can show a "removed file" mark.
    expect(
      asRoom(snap(room.id)).messages.some((message) => message.attachmentId === saved.id),
    ).toBe(true);
  });

  it('extracts a deterministic mock-AI summary from the chat', () => {
    const room = service.createRoom({ title: 'AI room', access: 'members' });
    service.postMessage(room.id, 'We agreed to extend the Oasis quotation until Friday.');
    service.postMessage(room.id, 'The buyer will upload the invoice tomorrow.');
    service.postMessage(room.id, 'Please verify the delivery date.');
    service.postMessage(room.id, 'Meeting notes are saved in the shared folder too.');

    const summary = service.summarizeRoom(room.id);
    if (!summary) throw new Error('summary expected');
    expect(summary.totalMessages).toBe(4);
    expect(summary.decisions).toContain('We agreed to extend the Oasis quotation until Friday.');
    expect(summary.actions.length).toBe(2);
    expect(summary.highlights[0]).toContain('We agreed');

    expect(service.summarizeRoom(999)).toBeNull();
  });
});
