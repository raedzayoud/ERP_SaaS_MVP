import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { InteractionService } from './interaction.service';

const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const CALL_ONE = 'd6000000-0000-4000-8000-000000000001';

describe('InteractionService', () => {
  let service: InteractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InteractionService);
  });

  it('lists the history of one contact', async () => {
    const items = await firstValueFrom(service.getForPartner(ATLAS));

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((item) => item.partnerId === ATLAS)).toBe(true);
  });

  it('sorts pending reminders from the most urgent', async () => {
    const reminders = await firstValueFrom(service.getPendingReminders());

    expect(reminders.length).toBeGreaterThanOrEqual(3);
    const dates = reminders.map((item) => item.reminderAt ?? '');
    const sorted = [...dates].sort((a, b) => a.localeCompare(b));
    expect(dates).toEqual(sorted);
  });

  it('hides reminders once they are done', async () => {
    await firstValueFrom(service.markReminderDone(CALL_ONE));

    const reminders = await firstValueFrom(service.getPendingReminders());
    expect(reminders.some((item) => item.id === CALL_ONE)).toBe(false);
  });

  it('requires a subject to save an interaction', async () => {
    const promise = firstValueFrom(
      service.save({
        id: null,
        partnerId: ATLAS,
        type: 'call',
        date: '2026-10-26',
        subject: '   ',
        notes: '',
        reminderAt: null,
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'noSubject' });
  });

  it('creates an interaction with a pending reminder when a date is set', async () => {
    const created = await firstValueFrom(
      service.save({
        id: null,
        partnerId: ATLAS,
        type: 'note',
        date: '2026-10-26',
        subject: 'Test note',
        notes: 'unit',
        reminderAt: '2026-11-15',
      }),
    );

    expect(created.reminderDone).toBe(false);
    expect(created.reminderAt).toBe('2026-11-15');
  });
});
