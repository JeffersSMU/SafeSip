import { describe, expect, it } from 'vitest';
import { T, fmtTime } from './time';
import {
  answerCheckInOk,
  cancelSos,
  confirmArrival,
  escalateCheckIn,
  goToBeat,
  initialWorld,
  nextBeat,
  nowMin,
  startSos,
  userWellbeing,
  watcherWellbeing,
  type World,
} from './world';

const t0 = 1_800_000_000_000;

describe('Scenario 1 beats (DESIGN §1.2)', () => {
  it('walks B0 → B10 with Next beat and ends inactive', () => {
    let w: World = initialWorld(t0);
    for (let i = 0; i < 10; i++) w = nextBeat(w, t0);
    // Ride stages are advanced one at a time by Next while booked.
    let guard = 0;
    while (w.beat < 10 && guard++ < 10) w = nextBeat(w, t0);
    expect(w.beat).toBe(10);
    expect(w.chloe.arrival).toBe(true);
    expect(fmtTime(nowMin(w, t0))).toBe('2:30 AM');
    expect(w.chloe.session?.venues).toEqual(['Zouk', 'Chupitos']);
    expect(w.chloe.session?.returnMin).toBe(T(2, 30, true));
    expect(w.chloe.ride?.fare.total).toBe(31.95);
    w = confirmArrival(w, true, t0);
    expect(w.chloe.session).toBeNull();
    expect(w.chloe.summary).toMatchObject({ drinks: 1, checkInsAnswered: 1, checkInsTotal: 1, endMin: T(2, 31, true) });
    expect(w.events.some((e) => e.text.includes('arrived home safely · 2:31 AM'))).toBe(true);
  });

  it('jumps straight to any beat', () => {
    const w = goToBeat(initialWorld(t0), 6, t0);
    expect(w.beat).toBe(6);
    expect(fmtTime(nowMin(w, t0))).toBe('12:30 AM');
    expect(w.chloe.checkIn?.answered).toBeNull();
    expect(userWellbeing(w, t0)).toBe('APART');
  });
});

describe('Watcher only sees SAFE / MISSING / SOS (decision 2)', () => {
  const at6 = () => goToBeat(initialWorld(t0), 6, t0);

  it('stays SAFE while the check-in is pending and after buddy escalation', () => {
    const w = at6();
    expect(watcherWellbeing(w.chloe, t0 + 30_000)).toBe('SAFE');
    expect(userWellbeing(w, t0 + 61_000)).toBe('MISSING');
    expect(watcherWellbeing(w.chloe, t0 + 90_000)).toBe('SAFE');
  });

  it('turns MISSING at 120 s and logs a loud alert to Helen', () => {
    let w = at6();
    expect(watcherWellbeing(w.chloe, t0 + 121_000)).toBe('MISSING');
    w = escalateCheckIn(w, t0 + 121_000)!;
    expect(w.events.filter((e) => e.loud && e.to.includes('watcher'))).toHaveLength(1);
    expect(escalateCheckIn(w, t0 + 122_000)).toBeNull(); // idempotent
    w = answerCheckInOk(w, t0 + 125_000);
    expect(watcherWellbeing(w.chloe, t0 + 126_000)).toBe('SAFE');
  });

  it('shows SOS until cancelled; Need Help skips a second confirmation', () => {
    let w = startSos(at6(), 'checkin', t0 + 5_000);
    expect(w.chloe.checkIn?.answered).toBe('help');
    expect(watcherWellbeing(w.chloe, t0 + 6_000)).toBe('SOS');
    w = cancelSos(w, t0 + 7_000);
    expect(watcherWellbeing(w.chloe, t0 + 8_000)).toBe('SAFE');
  });
});
