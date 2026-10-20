import { describe, expect, it } from 'vitest';
import { HOME, SARAH_HOME } from '../data/places';
import { T, fmtTime } from './time';
import {
  answerCheckInOk,
  bookRide,
  buddyView,
  cancelSos,
  chloePace,
  confirmArrival,
  editSession,
  escalateCheckIn,
  goToBeat,
  initialWorld,
  logDrink,
  moveWithoutEditing,
  nextBeat,
  nowMin,
  startSos,
  userWellbeing,
  watcherWellbeing,
  tickLocationTransition,
  ALL_AMENITIES,
  type World,
} from './world';

const t0 = 1_800_000_000_000;

describe('Scenario 1 beats (DESIGN §1.2)', () => {
  it('walks B0 → B11 with Next beat and ends inactive', () => {
    let w: World = initialWorld(t0);
    let guard = 0;
    while (!w.chloe.arrival && guard++ < 30) {
      if (w.locationTransition) {
        w = tickLocationTransition(w, w.locationTransition.startedMs + w.locationTransition.durationMs)!;
        continue;
      }
      if (w.chloe.venuePrompt && w.chloe.session) {
        const session = w.chloe.session;
        w = editSession(w, { venue: 'Chupitos', returnMin: session.returnMin, buddies: session.buddies }, t0);
        w = logDrink(w, { id: 'martini-test', name: 'Martini', detail: '90 ml', std: 2, emoji: '🍸', scanned: true }, t0);
      }
      w = nextBeat(w, t0);
    }
    expect(w.beat).toBe(11);
    expect(fmtTime(nowMin(w, t0))).toBe('2:30 AM');
    expect(w.chloe.session?.venues).toEqual(['Zouk', 'Chupitos']);
    expect(w.chloe.session?.returnMin).toBe(T(2, 30, true));
    expect(w.chloe.ride?.fare.total).toBe(31.95);
    w = confirmArrival(w, true, t0);
    expect(w.chloe.session).toBeNull();
    expect(w.chloe.summary).toMatchObject({ drinks: 1, checkInsAnswered: 1, checkInsTotal: 1, endMin: T(2, 31, true) });
    expect(w.events.some((e) => e.text.includes('arrived home safely · 2:31 AM'))).toBe(true);
  });

  it('freezes the clock at each beat time, so both phones always agree', () => {
    let w = goToBeat(initialWorld(t0), 4, t0);
    expect(fmtTime(nowMin(w, t0))).toBe('11:00 PM');
    w = tickLocationTransition(w, t0 + 6_000)!;
    expect(fmtTime(nowMin(w, t0 + 6_000))).toBe('11:10 PM');
    expect(fmtTime(nowMin(w, t0 + 10 * 60_000))).toBe('11:10 PM');
  });

  it('B1: Chloe and Sarah start from their own homes, meeting at Zouk, and the NoK gets a loud alert', () => {
    const w = goToBeat(initialWorld(t0), 1, t0);
    expect(w.chloe.pos).toEqual(HOME);
    expect(w.buddies.sarah.pos).toEqual(SARAH_HOME);
    expect(buddyView(w, 'sarah', t0)).toMatchObject({ status: 'SAFE' });
    expect(userWellbeing(w, t0)).toBe('SAFE');
    const start = w.events.find((e) => e.to.includes('watcher'));
    expect(start).toMatchObject({ loud: true });
    expect(start?.text).toContain('Zouk with Sarah · back by 2:00 AM');
  });

  it('B3: no venue prompt; Chloe edits the venue herself and gets a new destination', () => {
    let w = goToBeat(initialWorld(t0), 3, t0);
    expect(w.chloe.venuePrompt).toBeNull();
    w = editSession(w, { venue: 'Chupitos', returnMin: T(2, 0, true), buddies: ['sarah'] }, t0);
    expect(w.chloe.session?.venue).toBe('Chupitos');
    expect(w.chloe.session?.venuePos).not.toEqual(w.chloe.pos);
    w = nextBeat(w, t0); // B4 walks there; the drink is logged by the user via the dual camera
    expect(w.chloe.session?.venues).toEqual(['Zouk', 'Chupitos']);
    expect(w.chloe.venuePrompt).toBeNull();
    // User picked the venue, so the script must not pre-log a Martini for them.
    expect(w.chloe.drinks).toHaveLength(0);
  });

  it('prompts only when Chloe moves venue without editing the session', () => {
    const w = moveWithoutEditing(goToBeat(initialWorld(t0), 4, t0), t0);
    expect(w.chloe.venuePrompt).toBe('Headquarters by The Council');
  });

  it("B7: I'm Okay marks Chloe and Sarah SAFE while still apart", () => {
    let w = goToBeat(initialWorld(t0), 7, t0);
    expect(userWellbeing(w, t0)).toBe('APART');
    w = answerCheckInOk(w, t0 + 5_000);
    expect(userWellbeing(w, t0 + 6_000)).toBe('SAFE');
    expect(buddyView(w, 'sarah', t0 + 6_000).status).toBe('SAFE');
  });

  it('shares only the pace (LOW after the B5 Martini)', () => {
    expect(chloePace(goToBeat(initialWorld(t0), 6, t0), t0)).toBe('LOW');
  });

  it('prices a changed drop-off from its own distance', () => {
    const w = bookRide(goToBeat(initialWorld(t0), 8, t0), ALL_AMENITIES, t0, 'chupitos', 'sarah');
    expect(w.chloe.ride?.fare.km).toBe(9.3);
  });
});

describe('Watcher only sees SAFE / MISSING / SOS (decision 2)', () => {
  const at6 = () => goToBeat(initialWorld(t0), 7, t0);

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
    expect(w.events.filter((e) => e.loud && e.tone === 'danger' && e.to.includes('watcher'))).toHaveLength(1);
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
