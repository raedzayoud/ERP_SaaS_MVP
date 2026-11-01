import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { User } from '../../../../core/models/user';
import { RoomPage } from './room';

const ADMIN: User = { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin-entreprise' };
const SALES: User = { id: 2, name: 'Sales', email: 'commercial@demo.com', role: 'commercial' };
const WIRM: User = { id: 3, name: 'Warda', email: 'magasinier@demo.com', role: 'magasinier' };

/** Keys the room template renders (same trick as rooms.spec). */
const EN = {
  common: { back: 'Back' },
  roomlive: {
    access: { members: 'Open to members', 'invite-only': 'Private (invitation)' },
    status: { active: 'Live', archived: 'Archived' },
    room: {
      notFound: 'This room does not exist.',
      privateTitle: 'Private room',
      privateHint: 'Only invited participants can enter this room.',
      joinHint: 'You are visiting this open room.',
      join: 'Enter the room',
      leave: 'Leave',
      archivedBanner: 'This room is archived: writing is disabled.',
      reopen: 'Reopen room',
      backToRooms: 'Back to rooms',
    },
    chat: {
      title: 'Live chat',
      placeholder: 'Write a message…',
      send: 'Send',
      empty: 'The conversation starts with your first message.',
    },
    participants: {
      title: 'Participants',
      you: 'you',
      inviteLabel: 'Add a member',
      invitePlaceholder: 'Select a member…',
      add: 'Add',
      remove: 'Kick out',
      block: 'Block',
      roleLabel: 'Change role',
    },
    roles: { host: 'Host', participant: 'Participant', viewer: 'Observer' },
    ai: {
      title: 'AI summary',
      close: 'Close summary',
      messages: 'Messages:',
      attachments: 'Attachments:',
      highlights: 'Key points',
      decisions: 'Decisions taken',
      actions: 'Actions to complete',
      empty: 'Nothing detected yet.',
    },
  },
};

async function setupRoomPage(
  roomId: string,
  users: User[] = [ADMIN],
): Promise<{ fixture: ComponentFixture<RoomPage>; component: RoomPage }> {
  await TestBed.configureTestingModule({
    imports: [
      RoomPage,
      TranslocoTestingModule.forRoot({
        preloadLangs: true,
        langs: { en: EN },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      { provide: AuthService, useValue: { currentUser: () => ADMIN } },
      {
        provide: TenantService,
        useValue: {
          currentTenant: () => ({
            id: 1,
            companyName: 'Demo SARL',
            users,
          }),
          enabledModules: () => ['collab'],
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: roomId })) },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RoomPage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component };
}

describe('RoomPage', () => {
  it('opens the seeded room for its host with messages and a composer', async () => {
    const { fixture, component } = await setupRoomPage('1');
    const element = fixture.nativeElement as HTMLElement;

    expect(component.notFound()).toBe(false);
    expect(element.textContent).toContain('Sales weekly meeting');
    expect(element.textContent).toContain('Live chat');
    expect(element.textContent).toContain('Agenda for today');
    expect(element.querySelector('#chat-input')).toBeTruthy();
  });

  it('shows a not-found panel for unknown room ids', async () => {
    const { component, fixture } = await setupRoomPage('999');
    const element = fixture.nativeElement as HTMLElement;

    expect(component.notFound()).toBe(true);
    expect(component.room()).toBeNull();
    expect(element.textContent).toContain('This room does not exist.');
  });

  it('lets the host manage participants with moderation tools', async () => {
    const { component, fixture } = await setupRoomPage('1', [ADMIN, SALES, WIRM]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Add a member');
    // Every workspace user is already a participant, nobody is invitable yet.
    expect(component.invitableUsers()).toHaveLength(0);

    component.kickParticipant(3);
    expect(component.room()?.participants.some((p) => p.userId === 3)).toBe(false);
    expect(component.invitableUsers().some((u) => u.id === 3)).toBe(true);

    component.onRoleChange(2, 'viewer');
    expect(component.room()?.participants.find((p) => p.userId === 2)?.role).toBe('viewer');

    component.blockParticipant(3);
    expect(component.room()?.blockedUserIds).toContain(3);

    // Host transfer last: after it, the creator is no longer the moderator.
    component.onRoleChange(2, 'host');
    expect(component.room()?.ownerUserId).toBe(2);
  });

  it('shows and hides the mock-AI summary of the chat', async () => {
    const { component, fixture } = await setupRoomPage('1');

    component.toggleAI();
    expect(component.aiSummary()).not.toBeNull();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Key points');
    expect(component.aiSummary()?.highlights.length).toBeGreaterThan(0);

    component.toggleAI();
    expect(component.aiSummary()).toBeNull();
  });
});
