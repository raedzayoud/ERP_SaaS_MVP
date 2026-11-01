import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { User } from '../../../../core/models/user';
import { Rooms } from './rooms';
import { Room } from '../../models/room';

const ADMIN: User = { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin-entreprise' };

/** Small dictionary with the keys rendered by this page (same pattern as landing.spec). */
const EN = {
  titles: { rooms: 'Rooms Live' },
  descriptions: { rooms: 'Chat rooms with meetings and documents.' },
  common: { cancel: 'Cancel' },
  roomlive: {
    list: {
      newRoom: 'New live room',
      searchPlaceholder: 'Search rooms…',
      empty: 'No live room yet.',
    },
    create: {
      title: 'Create a live room',
      titleLabel: 'Room title',
      titlePlaceholder: 'e.g. Oasis follow-up',
      accessLabel: 'Who can enter?',
      linkedDocLabel: 'Linked document (optional)',
      linkedDocPlaceholder: 'e.g. FA-2026-031',
      inviteHint: 'Invite workspace members:',
      submit: 'Create room',
    },
    access: {
      members: 'Open to members',
      'invite-only': 'Private (invitation)',
    },
    status: { active: 'Live', archived: 'Archived' },
    card: { linkedDoc: 'Document', noMessagesYet: 'No message yet.' },
    errors: { titleLength: 'The title needs at least 3 characters.' },
  },
};

async function setupRoomsPage(): Promise<{ fixture: ComponentFixture<Rooms>; component: Rooms }> {
  await TestBed.configureTestingModule({
    imports: [
      Rooms,
      TranslocoTestingModule.forRoot({
        preloadLangs: true,
        langs: { en: EN },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      // The create flow navigates to /rooms/:id; a stub route absorbs it in tests.
      provideRouter([{ path: 'rooms/:id', redirectTo: 'rooms' }]),
      { provide: AuthService, useValue: { currentUser: () => ADMIN } },
      {
        provide: TenantService,
        useValue: {
          currentTenant: () => ({
            id: 1,
            companyName: 'Demo SARL',
            users: [ADMIN],
          }),
          enabledModules: () => ['collab'],
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Rooms);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component };
}

describe('Rooms page', () => {
  it('renders one card per accessible room with its private badge', async () => {
    const { fixture } = await setupRoomsPage();
    const element = fixture.nativeElement as HTMLElement;

    const cards = element.querySelectorAll('.room-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(element.textContent).toContain('Sales weekly meeting');
    expect(element.textContent).toContain('Private (invitation)');
  });

  it('creates a room from the form and lists it', async () => {
    const { component } = await setupRoomsPage();
    const before = component.rooms().length;

    component.toggleCreate();
    component.onTitleInput('Crisis room');
    component.onAccessChoice('members');
    component.createRoom();

    expect(component.rooms().some((room: Room) => room.title === 'Crisis room')).toBe(true);
    expect(component.rooms().length).toBe(before + 1);
  });

  it('rejects too short titles without touching the room list', async () => {
    const { component } = await setupRoomsPage();
    const before = component.rooms().length;

    component.toggleCreate();
    component.onTitleInput('ab');
    component.createRoom();

    expect(component.createError()).toBe('roomlive.errors.titleLength');
    expect(component.rooms().length).toBe(before);
  });
});
