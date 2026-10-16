// Per-child view model for the Watcher (DESIGN §6.2). Chloe is live scenario data; the optional
// demo child is static and always "Not out".

import { CHLOE, DEMO_EXTRA_CHILD, LINKED_RELATIONSHIP, personById, type Person } from '../../data/cast';
import type { LatLng } from '../../data/places';
import type { Pace } from '../../data/drinks';
import {
  chloePace,
  chloePos,
  emergencyId,
  trail60,
  watcherReason,
  watcherWellbeing,
  type Ride,
  type Session,
  type World,
  type WorldEvent,
} from '../../store/world';
import type { PillStatus } from '../../components/ui';

export interface ChildView {
  person: Person;
  relationship: string;
  session: Session | null;
  status: PillStatus; // SAFE | MISSING | SOS | OUT
  reason: string;
  pos: LatLng | null;
  trail: LatLng[];
  ride: Ride | null;
  buddies: Person[];
  emergency: string | null;
  updates: WorldEvent[];
  lastSession: string | null;
  /** Drinking pace only: the Watcher never sees the drink log (change request 4). */
  pace: Pace | null;
}

export function linkedIds(extraChild: boolean) {
  return extraChild ? [CHLOE.id, DEMO_EXTRA_CHILD.id] : [CHLOE.id];
}

export function childView(id: string, w: World, nowMs: number): ChildView {
  if (id !== CHLOE.id) {
    return {
      person: DEMO_EXTRA_CHILD,
      relationship: DEMO_EXTRA_CHILD.relationship,
      session: null,
      status: 'OUT',
      reason: '',
      pos: null,
      trail: [],
      ride: null,
      buddies: [],
      emergency: null,
      updates: [],
      lastSession: 'Last Night Out: Fri, 10 Oct · home safe 12:40 AM',
      pace: null,
    };
  }
  const c = w.chloe;
  const active = !!c.session;
  return {
    person: CHLOE,
    relationship: LINKED_RELATIONSHIP.chloe,
    session: c.session,
    status: active ? watcherWellbeing(c, nowMs) : 'OUT',
    reason: active ? watcherReason(w, c, nowMs) : '',
    // Privacy rule: no session, no location.
    pos: active ? chloePos(w, nowMs) : null,
    trail: active ? trail60(w, nowMs) : [],
    ride: c.ride,
    buddies: (c.session?.buddies ?? []).map(personById),
    emergency: active ? emergencyId(c, nowMs) : null,
    updates: w.events.filter((e) => e.userId === CHLOE.id && e.to.includes('watcher')).reverse(),
    lastSession: c.lastSession,
    pace: active ? chloePace(w, nowMs) : null,
  };
}

/** Emergency first, then active session, then list order (DESIGN §6.2 default selection). */
export function rankChildren(views: ChildView[]) {
  const score = (v: ChildView) => (v.emergency ? 0 : v.session ? 1 : 2);
  return [...views].sort((a, b) => score(a) - score(b));
}
