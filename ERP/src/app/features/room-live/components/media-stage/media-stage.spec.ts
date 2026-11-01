import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { User } from '../../../../core/models/user';
import { MediaStage } from './media-stage';

const ADMIN: User = { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin-entreprise' };
const SALES: User = { id: 2, name: 'Sales', email: 'commercial@demo.com', role: 'commercial' };

const EN = {
  roomlive: {
    media: {
      you: 'You',
      waiting: 'Waiting for video…',
      notStarted: 'Live session not started',
      join: 'Start live session',
      leave: 'End live session',
      micOn: 'Mute microphone',
      micOff: 'Unmute microphone',
      cameraOn: 'Turn camera off',
      cameraOff: 'Turn camera on',
      shareScreen: 'Share screen',
      shareShort: 'Screen',
      errors: {
        unsupported: 'Live audio/video is not available in this browser.',
        denied: 'Camera or microphone access was denied.',
      },
    },
  },
};

/** Log of stopped tracks, used to assert stream cleanup. */
const stopped: string[] = [];

const fakeTrack = (kind: 'audio' | 'video', enabled = true) => ({
  kind,
  enabled,
  stop: () => stopped.push(kind),
  addEventListener: () => undefined,
});

const fakeStream = (tracks: Array<ReturnType<typeof fakeTrack>>) =>
  ({
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  }) as unknown as MediaStream;

describe('MediaStage', () => {
  let fixture: ComponentFixture<MediaStage>;
  let component: MediaStage;
  let cameraStream: MediaStream;
  let screenStream: MediaStream;

  beforeEach(async () => {
    stopped.length = 0;
    cameraStream = fakeStream([fakeTrack('audio'), fakeTrack('video')]);
    screenStream = fakeStream([fakeTrack('video')]);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => cameraStream,
        getDisplayMedia: async () => screenStream,
      },
    });

    await TestBed.configureTestingModule({
      imports: [
        MediaStage,
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
            currentTenant: () => ({ id: 1, companyName: 'Demo SARL', users: [ADMIN, SALES] }),
            enabledModules: () => ['collab'],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MediaStage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a live session and toggles mic and camera', async () => {
    expect(component.mediaSupported()).toBe(true);

    await component.startSession();
    fixture.detectChanges();
    expect(component.sessionOn()).toBe(true);
    expect(component.camOn()).toBe(true);
    expect(component.micOn()).toBe(true);

    component.toggleMic();
    expect(component.micOn()).toBe(false);
    component.toggleCamera();
    expect(component.camOn()).toBe(false);
  });

  it('stops the session and releases the tracks', async () => {
    await component.startSession();
    await component.stopSession();
    fixture.detectChanges();

    expect(component.sessionOn()).toBe(false);
    expect(stopped).toContain('audio');
    expect(stopped).toContain('video');
  });

  it('switches from camera to screen sharing and back off', async () => {
    await component.startSession();
    await component.shareScreen();
    fixture.detectChanges();
    expect(component.screening()).toBe(true);
    expect(component.camOn()).toBe(false);

    await component.stopScreen();
    expect(component.sessionOn()).toBe(false);
  });

  it('shows the unsupported message without mediaDevices', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });

    // Fresh component: the mediaSupported computed above was already cached.
    const fresh = TestBed.createComponent(MediaStage);
    const other = fresh.componentInstance;
    fresh.detectChanges();
    expect(other.mediaSupported()).toBe(false);

    await other.startSession();
    expect(other.errorKey()).toBe('roomlive.media.errors.unsupported');
  });
});
