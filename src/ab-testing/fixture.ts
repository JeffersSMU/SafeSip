import { SARAH } from '../data/cast';
import { ZOUK } from '../data/places';
import { useUi, useWorld } from '../store';
import { clockAt, T } from '../store/time';
import { initialWorld, startSession } from '../store/world';

/** Give each A/B route load the same realistic starting session. */
export function seedABTestFixture() {
  const now = Date.now();
  const world = initialWorld(now);
  world.clock = clockAt(T(23), 0, now);
  world.chloe.pos = ZOUK;
  const active = startSession(world, { venue: 'Zouk', venuePos: ZOUK, returnMin: T(2, 0, true), buddies: [SARAH.id] }, now);
  active.chloe.pos = ZOUK;
  active.chloe.trail = [{ p: ZOUK, t: T(23) }];
  active.buddies[SARAH.id] = {
    ...active.buddies[SARAH.id],
    // Keep Sarah's marker just offset from Chloe's so both map pins remain tappable.
    pos: [ZOUK[0] + 0.00012, ZOUK[1] + 0.00012],
    withChloe: true,
    enRoute: false,
    updatedMin: T(23),
  };
  active.events = active.events.map((event) => ({ ...event, replayed: true }));
  useWorld.setState({ world: active });
  localStorage.setItem('safesip.ab-testing.world.v1', JSON.stringify(active));
  useUi.getState().set({ role: 'user', userTab: 'map', modal: null, fullscreen: null, sheet: null, editPreset: null });
}
