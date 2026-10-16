// The synced "world": everything both phones must agree on (DESIGN §7.1).
// All transitions are pure (World -> World) so beats, user taps and remote updates share one path.

import { CHLOE, SARAH, personById } from '../data/cast';
import { MARTINI, paceOf, type Pace } from '../data/drinks';
import {
  CHUPITOS,
  DRIVER_APPROACH,
  DROPOFFS,
  HOME,
  PICKUPS,
  RESTROOM,
  ROUTE_HOME,
  ROUTE_HOME_KM,
  SARAH_HOME,
  VENUES,
  ZOUK,
  distanceM,
  nearestVenue,
  pointAlong,
  sliceAlong,
  venuePos,
  type LatLng,
  type RidePoint,
} from '../data/places';
import { quoteFare, type Amenities, type FareQuote } from '../data/pricing';
import { START_MIN, T, clockAt, fmtTime, simNow, type Clock } from './time';

export type Wellbeing = 'SAFE' | 'APART' | 'MISSING' | 'SOS';
export type WatcherWellbeing = 'SAFE' | 'MISSING' | 'SOS';

export interface TrailPt {
  p: LatLng;
  t: number; // sim minute
}

export interface Session {
  venue: string;
  /** Target / meet-up point shown on the map. */
  venuePos: LatLng;
  venues: string[];
  returnMin: number;
  buddies: string[];
  startMin: number;
}

export interface DrinkEntry {
  id: string;
  name: string;
  detail: string;
  std: number;
  emoji: string;
  t: number;
  scanned?: boolean;
}

export interface CheckIn {
  id: string;
  openedMs: number;
  simMin: number;
  answered: null | 'ok' | 'help';
}

export interface Sos {
  id: string;
  startedMs: number;
  simMin: number;
  source: 'button' | 'checkin';
}

export type RideStage = 'matching' | 'found' | 'arriving' | 'trip' | 'arrived';

export interface Ride {
  id: string;
  stage: RideStage;
  stageMs: number;
  amenities: Amenities;
  fare: FareQuote;
  pickupId: string;
  dropId: string;
  bookedMin: number;
  pickupMin: number;
  etaMin: number;
}

export interface Summary {
  startMin: number;
  endMin: number;
  venues: string[];
  drinks: number;
  checkInsAnswered: number;
  checkInsTotal: number;
}

export interface ChildState {
  session: Session | null;
  pos: LatLng;
  trail: TrailPt[];
  /** Kept on the User's side; buddies and Next-of-Kin only ever see the derived pace (LOW/MED/HIGH). */
  drinks: DrinkEntry[];
  status: string | null;
  checkIn: CheckIn | null;
  checkInsTotal: number;
  checkInsAnswered: number;
  /** After "I'm Okay" Chloe counts as SAFE even while apart, until this sim minute. */
  okUntilMin: number | null;
  sos: Sos | null;
  ride: Ride | null;
  arrival: boolean;
  summary: Summary | null;
  venuePrompt: string | null;
  homeReminder: boolean;
  apartSinceMin: number | null;
  lastSession: string | null;
}

export interface BuddyState {
  pos: LatLng;
  pace: Pace;
  status: string | null;
  withChloe: boolean;
  /** Travelling to the meet-up point (B1), so not "apart". */
  enRoute: boolean;
  /** Answered her own well-being check-in; SAFE while apart until this sim minute. */
  okUntilMin: number | null;
  updatedMin: number;
}

export type Audience = 'user' | 'watcher';
export type Tone = 'info' | 'safe' | 'warn' | 'danger';

export interface WorldEvent {
  id: string;
  userId: string;
  simMin: number;
  ms: number;
  to: Audience[];
  text: string;
  tone: Tone;
  /** Non-silent (critical) alert on the recipient's phone. */
  loud?: boolean;
  /** Short title for a non-silent notification banner. */
  title?: string;
  /** Produced by a Director jump through intermediate beats: logged but never toasted. */
  replayed?: boolean;
  /** Ask the receiving User device to vibrate. */
  vibrate?: boolean;
}

export interface World {
  rev: number;
  by: string;
  clock: Clock;
  beat: number;
  chloe: ChildState;
  buddies: Record<string, BuddyState>;
  events: WorldEvent[];
}

// ---------- constants ----------

export const RIDE_STAGE_MS: Record<RideStage, number> = {
  matching: 3500,
  found: 7000,
  arriving: 15000,
  trip: 50000,
  arrived: 0,
};

export const CHECKIN_WARN_S = 30;
export const CHECKIN_BUDDY_S = 60;
export const CHECKIN_NOK_S = 120;
export const APART_CHECKIN_MIN = 30;

export const DEFAULT_SESSION = { venue: 'Zouk', returnMin: T(2, 0, true), buddies: ['sarah'] };
export const ALL_AMENITIES: Amenities = { bags: true, cover: true, water: true };

/**
 * The scenario clock is frozen at each beat's scripted time (rate 0) so both phones always show the
 * beat sheet's time, with no drift or device clock skew. It only runs during ride stages, to animate.
 */
const FROZEN = 0;

const near = (p: LatLng, dLat: number, dLng: number): LatLng => [p[0] + dLat, p[1] + dLng];
const beside = (p: LatLng): LatLng => near(p, 0.00004, 0.00026);
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function initialWorld(nowMs = Date.now()): World {
  return {
    rev: 0,
    by: '',
    clock: clockAt(START_MIN, FROZEN, nowMs),
    beat: 0,
    chloe: {
      session: null,
      pos: HOME,
      trail: [],
      drinks: [],
      status: null,
      checkIn: null,
      checkInsTotal: 0,
      checkInsAnswered: 0,
      okUntilMin: null,
      sos: null,
      ride: null,
      arrival: false,
      summary: null,
      venuePrompt: null,
      homeReminder: false,
      apartSinceMin: null,
      lastSession: 'Last Night Out: Sat, 11 Oct · home safe 1:12 AM',
    },
    buddies: {
      sarah: { pos: SARAH_HOME, pace: 'LOW', status: null, withChloe: false, enRoute: false, okUntilMin: null, updatedMin: START_MIN },
    },
    events: [],
  };
}

// ---------- small helpers ----------

const clone = <V>(v: V): V => structuredClone(v);
export const nowMin = (w: World, nowMs = Date.now()) => simNow(w.clock, nowMs);

function addEvent(w: World, e: Omit<WorldEvent, 'ms' | 'simMin' | 'userId' | 'tone'> & { tone?: Tone }, nowMs: number) {
  if (w.events.some((x) => x.id === e.id)) return;
  w.events.push({ userId: 'chloe', tone: 'info', ...e, ms: nowMs, simMin: Math.round(nowMin(w, nowMs)) });
  if (w.events.length > 120) w.events = w.events.slice(-120);
}

function setTime(w: World, simMin: number, nowMs: number, rate = FROZEN) {
  w.clock = clockAt(simMin, rate, nowMs);
}

/** Append walk points from the current position to `to` between sim minutes `t0`..`t1`. */
function walk(w: World, to: LatLng, t0: number, t1: number, steps = 6) {
  const from = w.chloe.pos;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    w.chloe.trail.push({ p: [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f], t: t0 + (t1 - t0) * f });
  }
  w.chloe.pos = to;
}

/** Deterministic jitter inside a venue every 5 sim minutes, so the 60-minute trail looks alive. */
function dwell(w: World, center: LatLng, t0: number, t1: number) {
  let seed = Math.floor(t0 * 7919) % 233280;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.00018;
  for (let t = t0 + 5; t <= t1; t += 5) w.chloe.trail.push({ p: [center[0] + rnd(), center[1] + rnd()], t });
  w.chloe.pos = center;
}

const lastTrailT = (w: World) => w.chloe.trail.at(-1)?.t ?? START_MIN;

/** Move every buddy who is with Chloe to stand beside her. */
function bringBuddies(w: World, t: number) {
  for (const id of w.chloe.session?.buddies ?? []) {
    const b = w.buddies[id];
    if (b && b.withChloe) {
      b.pos = beside(w.chloe.pos);
      b.updatedMin = t;
    }
  }
}

// ---------- derived state ----------

export function checkInElapsedS(c: CheckIn | null, nowMs = Date.now()) {
  return c ? (nowMs - c.openedMs) / 1000 : 0;
}

export const checkInOpen = (c: ChildState) => !!c.checkIn && c.checkIn.answered === null;

export function buddyDistanceM(w: World, id: string, nowMs = Date.now()) {
  const b = w.buddies[id];
  return b ? distanceM(b.pos, chloePos(w, nowMs)) : 0;
}

/** A buddy's status and short label as Chloe sees them. */
export function buddyView(w: World, id: string, nowMs = Date.now()): { status: 'SAFE' | 'APART'; label: string; d: number } {
  const b = w.buddies[id];
  const d = Math.round(buddyDistanceM(w, id, nowMs) / 5) * 5;
  if (!b) return { status: 'SAFE', label: '', d };
  if (b.withChloe) return { status: 'SAFE', label: 'With you', d };
  if (b.enRoute) return { status: 'SAFE', label: `On the way to ${w.chloe.session?.venue ?? 'the venue'}`, d };
  if (b.okUntilMin !== null && nowMin(w, nowMs) < b.okUntilMin) return { status: 'SAFE', label: `Checked in · ${d} m`, d };
  return { status: 'APART', label: `Apart · ${d} m`, d };
}

/** Chloe's status as her Night Buddies (and her own phone) see it. */
export function userWellbeing(w: World, nowMs = Date.now()): Wellbeing {
  const c = w.chloe;
  if (c.sos) return 'SOS';
  if (checkInOpen(c) && checkInElapsedS(c.checkIn, nowMs) >= CHECKIN_BUDDY_S) return 'MISSING';
  if (!c.session || c.ride) return 'SAFE';
  if (c.okUntilMin !== null && nowMin(w, nowMs) < c.okUntilMin) return 'SAFE';
  if (c.session.buddies.some((b) => w.buddies[b] && buddyView(w, b, nowMs).status === 'APART')) return 'APART';
  return 'SAFE';
}

/** The Watcher only ever sees SAFE, MISSING (after escalation reaches her) or SOS (confirmed decision 2). */
export function watcherWellbeing(c: ChildState, nowMs = Date.now()): WatcherWellbeing {
  if (c.sos) return 'SOS';
  if (checkInOpen(c) && checkInElapsedS(c.checkIn, nowMs) >= CHECKIN_NOK_S) return 'MISSING';
  return 'SAFE';
}

export function watcherReason(w: World, c: ChildState, nowMs = Date.now()): string {
  const s = watcherWellbeing(c, nowMs);
  if (s === 'SOS' && c.sos) return `${CHLOE.short} asked for help ${fmtTime(c.sos.simMin)}`;
  if (s === 'MISSING') return 'Unresponsive to last well-being check';
  if (c.ride) return c.ride.stage === 'arrived' ? 'Ride arrived' : `In a Grab ride · ETA ${fmtTime(c.ride.etaMin)}`;
  if (c.checkIn?.answered === 'ok') return `Answered check-in @ ${fmtTime(c.checkIn.simMin)}`;
  if (c.session?.buddies.some((b) => w.buddies[b]?.withChloe)) return 'With her Night Buddy';
  if (c.session?.buddies.some((b) => w.buddies[b]?.enRoute)) return `Heading to ${c.session.venue}`;
  return 'Sharing live location';
}

/** Emergency identity, so the Watcher's full-screen alert shows once per emergency. */
export function emergencyId(c: ChildState, nowMs = Date.now()): string | null {
  const s = watcherWellbeing(c, nowMs);
  if (s === 'SOS' && c.sos) return `sos:${c.sos.id}`;
  if (s === 'MISSING' && c.checkIn) return `missing:${c.checkIn.id}`;
  return null;
}

export function stdTotal(c: ChildState) {
  return Math.round(c.drinks.reduce((s, d) => s + d.std, 0) * 10) / 10;
}

/** The only drinking information shared with Night Buddies and Next-of-Kin (change request 4). */
export function chloePace(w: World, nowMs = Date.now()): Pace {
  const c = w.chloe;
  const t = nowMin(w, nowMs);
  const hours = c.session ? (t - c.session.startMin) / 60 : 1;
  return paceOf(stdTotal(c), Math.max(0.5, hours));
}

// ---------- ride geometry ----------

export const pickupById = (id: string): RidePoint => PICKUPS.find((p) => p.id === id) ?? PICKUPS[0];
export const dropById = (id: string): RidePoint => DROPOFFS.find((p) => p.id === id) ?? DROPOFFS[0];

/** Route polyline for a pickup/drop-off pair, reusing the pre-computed OSRM route (hardcoded). */
export function rideRoute(pickupId: string, dropId: string): LatLng[] {
  const pick = pickupById(pickupId);
  const drop = dropById(dropId);
  let k = ROUTE_HOME.length - 1;
  if (drop.id !== 'home') {
    let best = Infinity;
    ROUTE_HOME.forEach((p, i) => {
      const m = distanceM(p, drop.pos);
      if (m < best) {
        best = m;
        k = i;
      }
    });
  }
  const mid = ROUTE_HOME.slice(1, k);
  return [pick.pos, ...mid, drop.pos];
}

export const rideKm = (pickupId: string, dropId: string) =>
  Math.round((ROUTE_HOME_KM + pickupById(pickupId).dKm + dropById(dropId).dKm) * 10) / 10;

/** Car and Chloe position during a ride, derived from stage timing so no position streaming is needed. */
export function ridePositions(r: Ride, nowMs = Date.now()): { car: LatLng; path: LatLng[]; progress: number; route: LatLng[] } {
  const f = Math.min(1, Math.max(0, (nowMs - r.stageMs) / (RIDE_STAGE_MS[r.stage] || 1)));
  const route = rideRoute(r.pickupId, r.dropId);
  const approach = [...DRIVER_APPROACH.slice(0, -1), pickupById(r.pickupId).pos];
  switch (r.stage) {
    case 'matching':
    case 'found':
      return { car: approach[0], path: [], progress: 0, route };
    case 'arriving':
      return { car: pointAlong(approach, f), path: [], progress: 0, route };
    case 'trip':
      return { car: pointAlong(route, f), path: sliceAlong(route, f), progress: f, route };
    case 'arrived':
      return { car: route[route.length - 1], path: route, progress: 1, route };
  }
}

export function chloePos(w: World, nowMs = Date.now()): LatLng {
  const r = w.chloe.ride;
  if (r && (r.stage === 'trip' || r.stage === 'arrived')) return ridePositions(r, nowMs).car;
  return w.chloe.pos;
}

/** Trail points within the last 60 sim minutes, including the live ride path. */
export function trail60(w: World, nowMs = Date.now()): LatLng[] {
  const now = nowMin(w, nowMs);
  const pts = w.chloe.trail.filter((p) => p.t >= now - 60 && p.t <= now + 0.01).map((p) => p.p);
  const r = w.chloe.ride;
  if (r && (r.stage === 'trip' || r.stage === 'arrived')) pts.push(...ridePositions(r, nowMs).path);
  else if (w.chloe.session) pts.push(w.chloe.pos);
  return pts;
}

export const batteryAt = (simMin: number, from: number, to: number) =>
  Math.round(Math.max(to, Math.min(from, from - ((simMin - START_MIN) * (from - to)) / (T(2, 30, true) - START_MIN))));

export const chloeBattery = (w: World, nowMs = Date.now()) => batteryAt(nowMin(w, nowMs), 82, 61);
export const buddyBattery = (w: World, nowMs = Date.now()) => batteryAt(nowMin(w, nowMs), 74, 63);

// ---------- user actions ----------

export interface SessionInput {
  venue: string;
  venuePos?: LatLng;
  returnMin: number;
  buddies: string[];
}

const buddyNames = (ids: string[]) => ids.map((b) => personById(b).short).join(' & ') || 'no buddies';

function ensureBuddy(w: World, id: string, now: number, o: { withChloe: boolean; enRoute?: boolean; pos?: LatLng }) {
  const pos = o.pos ?? beside(w.chloe.pos);
  const prev = w.buddies[id];
  w.buddies[id] = {
    pos,
    pace: prev?.pace ?? 'LOW',
    status: prev?.status ?? null,
    withChloe: o.withChloe,
    enRoute: !!o.enRoute,
    okUntilMin: null,
    updatedMin: now,
  };
}

export function startSession(w0: World, input: SessionInput, nowMs = Date.now()): World {
  const w = clone(w0);
  const now = Math.round(nowMin(w, nowMs));
  const target = input.venuePos ?? venuePos(input.venue);
  w.chloe.session = {
    venue: input.venue,
    venuePos: target,
    venues: [input.venue],
    returnMin: input.returnMin,
    buddies: input.buddies,
    startMin: now,
  };
  // Chloe starts wherever she is (home at B1); her buddies head to the meet-up point from their own place.
  w.chloe.trail = [{ p: w.chloe.pos, t: now }];
  w.chloe.summary = null;
  w.chloe.drinks = [];
  w.chloe.checkInsTotal = 0;
  w.chloe.checkInsAnswered = 0;
  w.chloe.okUntilMin = null;
  for (const b of input.buddies) {
    if (b === SARAH.id) ensureBuddy(w, b, now, { withChloe: false, enRoute: true, pos: SARAH_HOME });
    else ensureBuddy(w, b, now, { withChloe: false, enRoute: true, pos: near(target, 0.004, -0.006) });
  }
  w.beat = Math.max(w.beat, 1);
  const details = `${input.venue} with ${buddyNames(input.buddies)} · back by ${fmtTime(input.returnMin)}`;
  addEvent(w, { id: `start-${now}-u`, to: ['user'], text: 'Session started · Helen notified', tone: 'safe' }, nowMs);
  // Change request 11: the Next-of-Kin gets a non-silent notification with the session details.
  addEvent(
    w,
    { id: `start-${now}-w`, to: ['watcher'], loud: true, title: `${CHLOE.short} started a Night Out`, text: `Heading to ${details}` },
    nowMs,
  );
  return w;
}

export function editSession(w0: World, input: SessionInput, nowMs = Date.now()): World {
  const w = clone(w0);
  const s = w.chloe.session;
  if (!s) return w;
  const now = Math.round(nowMin(w, nowMs));
  const venueChanged = input.venue !== s.venue;
  const added = input.buddies.filter((b) => !s.buddies.includes(b));
  s.venue = input.venue;
  if (venueChanged) {
    s.venues.push(input.venue);
    s.venuePos = input.venuePos ?? venuePos(input.venue);
  }
  s.returnMin = input.returnMin;
  s.buddies = input.buddies;
  for (const b of added) ensureBuddy(w, b, now, { withChloe: true });
  w.chloe.venuePrompt = null;
  addEvent(
    w,
    {
      id: `edit-${now}-${input.venue}-u`,
      to: ['user'],
      text: venueChanged ? 'Session updated · Helen notified of venue change' : 'Session updated · Helen notified',
      tone: 'safe',
    },
    nowMs,
  );
  if (venueChanged) addEvent(w, { id: `edit-${now}-${input.venue}-w`, to: ['watcher'], text: `Venue changed to ${input.venue}` }, nowMs);
  if (added.length) addEvent(w, { id: `edit-${now}-buddies-w`, to: ['watcher'], text: `${buddyNames(added)} joined ${CHLOE.short}'s session` }, nowMs);
  if (!venueChanged && !added.length)
    addEvent(w, { id: `edit-${now}-ret-w`, to: ['watcher'], text: `Back by ${fmtTime(input.returnMin)}` }, nowMs);
  return w;
}

export function dismissVenuePrompt(w0: World): World {
  const w = clone(w0);
  w.chloe.venuePrompt = null;
  return w;
}

/**
 * Director: Chloe walks to a different venue WITHOUT editing her session. The app notices her location
 * no longer matches the session venue and asks whether to update it (change request 13).
 */
export function moveWithoutEditing(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const s = w.chloe.session;
  if (!s) return w;
  const t = Math.round(nowMin(w, nowMs));
  const dest = VENUES.find((v) => v.name !== s.venue && v.name !== 'Clarke Quay' && distanceM(v.pos, w.chloe.pos) < 1500 && distanceM(v.pos, w.chloe.pos) > 150) ?? VENUES[5];
  walk(w, dest.pos, t, t, 4);
  bringBuddies(w, t);
  detectVenueChange(w);
  return w;
}

/** Prompt only when Chloe is at a listed venue that is not her session venue. */
function detectVenueChange(w: World) {
  const s = w.chloe.session;
  if (!s) return;
  const { venue, m } = nearestVenue(w.chloe.pos);
  w.chloe.venuePrompt = m < 60 && venue.name !== s.venue && distanceM(w.chloe.pos, s.venuePos) > 40 ? venue.name : null;
}

function closeSession(w: World) {
  w.chloe.session = null;
  w.chloe.ride = null;
  w.chloe.checkIn = null;
  w.chloe.sos = null;
  w.chloe.arrival = false;
  w.chloe.venuePrompt = null;
  w.chloe.homeReminder = false;
  w.chloe.apartSinceMin = null;
  w.chloe.okUntilMin = null;
  w.chloe.trail = [];
  for (const b of Object.values(w.buddies)) {
    b.withChloe = false;
    b.enRoute = false;
    b.okUntilMin = null;
  }
}

export function endSessionNow(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const now = Math.round(nowMin(w, nowMs));
  const start = w.chloe.session?.startMin ?? now;
  closeSession(w);
  w.chloe.lastSession = `Last Night Out: ${fmtTime(start)} – ${fmtTime(now)} · ended by ${CHLOE.short}`;
  addEvent(w, { id: `end-${now}-u`, to: ['user'], text: 'Session ended · Helen notified', tone: 'info' }, nowMs);
  addEvent(w, { id: `end-${now}-w`, to: ['watcher'], text: `${CHLOE.short} ended her Night Out` }, nowMs);
  return w;
}

export function arrangeOwnRide(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  w.chloe.homeReminder = false;
  addEvent(w, { id: uid('own'), to: ['user'], text: "We'll keep tracking until you're home", tone: 'info' }, nowMs);
  addEvent(w, { id: uid('own-w'), to: ['watcher'], text: `${CHLOE.short} is getting home herself` }, nowMs);
  return w;
}

export function dismissHomeReminder(w0: World): World {
  const w = clone(w0);
  w.chloe.homeReminder = false;
  return w;
}

export function logDrink(w0: World, d: Omit<DrinkEntry, 't'>, nowMs = Date.now()): World {
  const w = clone(w0);
  const now = Math.round(nowMin(w, nowMs));
  w.chloe.drinks.unshift({ ...d, t: now });
  if (w.beat === 3 && d.scanned) w.beat = 4;
  addEvent(w, { id: `drink-${d.id}`, to: ['user'], text: `${d.name} logged${w.chloe.session ? ' · only your pace is shared' : ''}`, tone: 'safe' }, nowMs);
  return w;
}

export function undoDrink(w0: World, id: string): World {
  const w = clone(w0);
  w.chloe.drinks = w.chloe.drinks.filter((d) => d.id !== id);
  return w;
}

export function setStatus(w0: World, status: string | null): World {
  const w = clone(w0);
  w.chloe.status = status;
  return w;
}

export function manualCheckIn(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const now = Math.round(nowMin(w, nowMs));
  if (w.chloe.apartSinceMin !== null) w.chloe.apartSinceMin = now;
  addEvent(w, { id: `mci-${nowMs}`, to: ['user'], text: 'Check-in sent to your Night Buddies & Helen', tone: 'safe' }, nowMs);
  if (w.chloe.session) addEvent(w, { id: `mci-${nowMs}-w`, to: ['watcher'], text: `${CHLOE.short} checked in · all good` }, nowMs);
  return w;
}

// ---------- well-being check-in ----------

export function fireCheckIn(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  if (!w.chloe.session || checkInOpen(w.chloe)) return w;
  const now = Math.round(nowMin(w, nowMs));
  w.chloe.checkIn = { id: uid('ci'), openedMs: nowMs, simMin: now, answered: null };
  w.chloe.checkInsTotal += 1;
  w.chloe.okUntilMin = null;
  if (w.chloe.apartSinceMin !== null) w.chloe.apartSinceMin = now;
  addEvent(w, { id: `${w.chloe.checkIn.id}-open`, to: [], text: 'Well-being check-in', vibrate: true }, nowMs);
  return w;
}

/**
 * "I'm Okay": Chloe shows as SAFE again for one check-in interval. Sarah is assumed to have had the same
 * check-in and answered it too (change request 14), so she also shows SAFE while apart.
 */
export function answerCheckInOk(w0: World, nowMs = Date.now(), intervalMin = APART_CHECKIN_MIN): World {
  const w = clone(w0);
  const c = w.chloe.checkIn;
  if (!c || c.answered) return w;
  const elapsed = checkInElapsedS(c, nowMs);
  const now = Math.round(nowMin(w, nowMs));
  c.answered = 'ok';
  w.chloe.checkInsAnswered += 1;
  w.chloe.okUntilMin = now + intervalMin;
  if (w.chloe.apartSinceMin !== null) w.chloe.apartSinceMin = now;
  for (const id of w.chloe.session?.buddies ?? []) {
    const b = w.buddies[id];
    if (b && !b.withChloe) {
      b.okUntilMin = now + intervalMin;
      b.updatedMin = now;
    }
  }
  addEvent(
    w,
    {
      id: `${c.id}-ok`,
      to: ['user'],
      text: elapsed >= CHECKIN_BUDDY_S ? "Thanks! We've told Sarah you're safe." : "Thanks! You're marked Safe · Sarah checked in too",
      tone: 'safe',
    },
    nowMs,
  );
  if (elapsed >= CHECKIN_NOK_S)
    addEvent(w, { id: `${c.id}-ok-w`, to: ['watcher'], text: `${CHLOE.short} is safe · answered her check-in`, tone: 'safe', loud: true, title: `${CHLOE.short} is safe` }, nowMs);
  return w;
}

/** Escalation for an unanswered check-in (DESIGN §5.7). Idempotent: safe to call every tick. */
export function escalateCheckIn(w0: World, nowMs = Date.now()): World | null {
  const c = w0.chloe.checkIn;
  if (!c || c.answered) return null;
  const s = checkInElapsedS(c, nowMs);
  const want: string[] = [];
  if (s >= CHECKIN_WARN_S) want.push('warn');
  if (s >= CHECKIN_BUDDY_S) want.push('buddy');
  if (s >= CHECKIN_NOK_S) want.push('nok');
  const missing = want.filter((k) => !w0.events.some((e) => e.id === `${c.id}-${k}`));
  if (!missing.length) return null;
  const w = clone(w0);
  for (const k of missing) {
    if (k === 'warn')
      addEvent(w, { id: `${c.id}-warn`, to: ['user'], text: 'Sarah and Helen will be notified in 30 s', tone: 'warn', vibrate: true }, nowMs);
    if (k === 'buddy')
      addEvent(w, { id: `${c.id}-buddy`, to: ['user'], text: 'Sarah has been alerted that you missed a check-in', tone: 'danger', vibrate: true }, nowMs);
    if (k === 'nok')
      addEvent(
        w,
        { id: `${c.id}-nok`, to: ['user', 'watcher'], text: `${CHLOE.short} hasn't answered a well-being check-in`, tone: 'danger', loud: true, vibrate: true },
        nowMs,
      );
  }
  return w;
}

// ---------- SOS ----------

export function startSos(w0: World, source: Sos['source'], nowMs = Date.now()): World {
  const w = clone(w0);
  if (w.chloe.sos || !w.chloe.session) return w;
  const now = Math.round(nowMin(w, nowMs));
  if (source === 'checkin' && w.chloe.checkIn && !w.chloe.checkIn.answered) w.chloe.checkIn.answered = 'help';
  w.chloe.sos = { id: uid('sos'), startedMs: nowMs, simMin: now, source };
  addEvent(
    w,
    { id: `${w.chloe.sos.id}-w`, to: ['watcher'], text: `🚨 ${CHLOE.short} sent an SOS from ${w.chloe.session.venue}`, tone: 'danger', loud: true },
    nowMs,
  );
  return w;
}

export function cancelSos(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const s = w.chloe.sos;
  if (!s) return w;
  w.chloe.sos = null;
  addEvent(w, { id: `${s.id}-safe-u`, to: ['user'], text: 'Alert cancelled · Sarah & Helen know you’re safe', tone: 'safe' }, nowMs);
  addEvent(w, { id: `${s.id}-safe-w`, to: ['watcher'], text: `${CHLOE.short} is safe now · SOS cancelled`, tone: 'safe', loud: true, title: `${CHLOE.short} is safe` }, nowMs);
  return w;
}

/** SOS step-1 recipients: every session Night Buddy, then Next-of-Kin. */
export function sosRecipients(w: World): string[] {
  return [...(w.chloe.session?.buddies ?? []), 'helen'];
}

// ---------- ride ----------

export function quoteNow(w: World, amenities: Amenities, km = ROUTE_HOME_KM, nowMs = Date.now()) {
  return quoteFare(km, Math.round(nowMin(w, nowMs)), amenities);
}

/** Opening the ride flow from the B8 reminder compresses time to the scenario booking time (1:55 AM). */
export function enterRideQuote(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  w.chloe.homeReminder = false;
  const t = T(1, 55, true);
  if (w.beat === 8 && nowMin(w, nowMs) < t) {
    dwell(w, w.chloe.pos, lastTrailT(w), t);
    bringBuddies(w, t);
    setTime(w, t, nowMs);
  }
  return w;
}

export function bookRide(w0: World, amenities: Amenities, nowMs = Date.now(), pickupId = 'chupitos', dropId = 'home'): World {
  const w = clone(w0);
  if (!w.chloe.session) return w;
  const booked = Math.round(nowMin(w, nowMs));
  const fare = quoteFare(rideKm(pickupId, dropId), booked, amenities);
  w.chloe.homeReminder = false;
  w.chloe.ride = {
    id: uid('ride'),
    stage: 'matching',
    stageMs: nowMs,
    amenities,
    fare,
    pickupId,
    dropId,
    bookedMin: booked,
    pickupMin: booked + 5,
    etaMin: booked + 5 + fare.minutes,
  };
  w.beat = Math.max(w.beat, 9);
  return w;
}

export function cancelRide(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const r = w.chloe.ride;
  if (!r) return w;
  w.chloe.ride = null;
  setTime(w, Math.round(nowMin(w, nowMs)), nowMs);
  addEvent(w, { id: `${r.id}-cancel`, to: ['user'], text: 'Booking cancelled · no charge', tone: 'info' }, nowMs);
  return w;
}

const NEXT_STAGE: Partial<Record<RideStage, RideStage>> = { matching: 'found', found: 'arriving', arriving: 'trip', trip: 'arrived' };

export function advanceRide(w0: World, nowMs = Date.now()): World {
  const w = clone(w0);
  const r = w.chloe.ride;
  if (!r) return w;
  const next = NEXT_STAGE[r.stage];
  if (!next) return w;
  r.stage = next;
  r.stageMs = nowMs;
  const drop = dropById(r.dropId);
  if (next === 'found' && w.chloe.session) {
    w.chloe.session.returnMin = r.etaMin;
    addEvent(w, { id: `${r.id}-ext`, to: ['user'], text: `Session extended to ${fmtTime(r.etaMin)} to match your ride · Helen notified`, tone: 'safe' }, nowMs);
    addEvent(w, { id: `${r.id}-w`, to: ['watcher'], text: `${CHLOE.short} is heading ${drop.id === 'home' ? 'home' : `to ${drop.name}`} in a SafeSip ride · ETA ${fmtTime(r.etaMin)}` }, nowMs);
  }
  if (next === 'arriving') setTime(w, r.bookedMin, nowMs, (r.pickupMin - r.bookedMin) / (RIDE_STAGE_MS.arriving / 60000));
  if (next === 'trip') {
    setTime(w, r.pickupMin, nowMs, (r.etaMin - r.pickupMin) / (RIDE_STAGE_MS.trip / 60000));
    w.chloe.pos = pickupById(r.pickupId).pos;
    for (const b of Object.values(w.buddies)) b.withChloe = false;
  }
  if (next === 'arrived') {
    setTime(w, r.etaMin, nowMs);
    const route = rideRoute(r.pickupId, r.dropId);
    route.forEach((p, i) => w.chloe.trail.push({ p, t: r.pickupMin + ((r.etaMin - r.pickupMin) * (i + 1)) / route.length }));
    w.chloe.pos = drop.pos;
    w.chloe.arrival = true;
    w.beat = 10;
  }
  return w;
}

/** Auto-advance a ride whose stage has run its course. Returns null when nothing is due. */
export function tickRide(w0: World, nowMs = Date.now()): World | null {
  const r = w0.chloe.ride;
  if (!r || r.stage === 'arrived') return null;
  return nowMs - r.stageMs >= RIDE_STAGE_MS[r.stage] ? advanceRide(w0, nowMs) : null;
}

// ---------- arrival ----------

export function confirmArrival(w0: World, home: boolean, nowMs = Date.now()): World {
  const w = clone(w0);
  const c = w.chloe;
  const now = Math.round(nowMin(w, nowMs));
  c.arrival = false;
  if (!home) {
    c.ride = null;
    setTime(w, now, nowMs);
    addEvent(w, { id: `notyet-${nowMs}`, to: ['user'], text: 'OK, your session stays on until you’re home', tone: 'info' }, nowMs);
    return w;
  }
  const end = Math.max(now, (c.ride?.etaMin ?? now) + 1);
  const dropPos = c.ride ? dropById(c.ride.dropId).pos : HOME;
  setTime(w, end, nowMs);
  c.summary = {
    startMin: c.session?.startMin ?? START_MIN,
    endMin: end,
    venues: c.session?.venues ?? [],
    drinks: c.drinks.length,
    checkInsAnswered: c.checkInsAnswered,
    checkInsTotal: c.checkInsTotal,
  };
  c.lastSession = `Last Night Out: ${fmtTime(c.summary.startMin)} – ${fmtTime(end)} · home safe`;
  closeSession(w);
  c.pos = dropPos;
  addEvent(w, { id: `home-${end}-w`, to: ['watcher'], text: `${CHLOE.short} arrived home safely · ${fmtTime(end)}`, tone: 'safe' }, nowMs);
  return w;
}

export function finishSummary(w0: World): World {
  const w = clone(w0);
  w.chloe.summary = null;
  return w;
}

// ---------- automatic triggers (run on the User's device) ----------

export function tickApart(w0: World, nowMs = Date.now(), intervalMin = APART_CHECKIN_MIN): World | null {
  const c = w0.chloe;
  if (!c.session || c.apartSinceMin === null || checkInOpen(c) || c.sos || c.ride) return null;
  return nowMin(w0, nowMs) - c.apartSinceMin >= intervalMin ? fireCheckIn(w0, nowMs) : null;
}

// ---------- Demo Director beats (DESIGN §1.2 / §7) ----------

export const BEATS: { n: number; time: string; label: string }[] = [
  { n: 0, time: '9:00 PM', label: 'Inactive at home' },
  { n: 1, time: '9:00 PM', label: 'Start session: meet Sarah at Zouk · 2:00 AM' },
  { n: 2, time: '9:30 PM', label: 'Both arrive at Zouk, paired with Sarah' },
  { n: 3, time: '11:00 PM', label: 'Chloe edits venue → Chupitos (Edit Session)' },
  { n: 4, time: '11:10 PM', label: 'Walk to Chupitos · log a Martini' },
  { n: 5, time: '12:00 AM', label: 'Sarah leaves (restroom queue)' },
  { n: 6, time: '12:30 AM', label: 'Apart 30 min → well-being check-in' },
  { n: 7, time: '12:35 AM', label: 'Sarah returns' },
  { n: 8, time: '1:45 AM', label: '“Time to head home?” reminder' },
  { n: 9, time: '1:55 AM', label: 'Ride booked Chupitos → Yishun' },
  { n: 10, time: '2:30 AM', label: 'Arrived home → “Have you reached home?”' },
];

function applyBeat(w0: World, n: number, nowMs: number): World {
  let w = clone(w0);
  const c = () => w.chloe;
  switch (n) {
    case 0:
      return { ...initialWorld(nowMs), rev: w0.rev, by: w0.by };
    case 1:
      setTime(w, START_MIN, nowMs);
      if (!c().session) w = startSession(w, DEFAULT_SESSION, nowMs);
      w.beat = 1;
      return w;
    case 2: {
      const t = T(21, 30);
      const target = c().session?.venuePos ?? ZOUK;
      walk(w, target, lastTrailT(w), T(21, 28), 10);
      dwell(w, target, T(21, 28), t);
      setTime(w, t, nowMs);
      for (const b of c().session?.buddies ?? []) ensureBuddy(w, b, t, { withChloe: true });
      w.beat = 2;
      addEvent(w, { id: 'b2-u', to: ['user'], text: `Arrived at ${c().session?.venue ?? 'Zouk'} · paired with Sarah`, tone: 'safe' }, nowMs);
      addEvent(w, { id: 'b2-w', to: ['watcher'], text: `${CHLOE.short} arrived at ${c().session?.venue ?? 'Zouk'} with Sarah` }, nowMs);
      return w;
    }
    case 3: {
      // Time moves to 11:00 PM; Chloe then changes the venue herself in Edit Session (no prompt).
      const t = T(23, 0);
      dwell(w, c().pos, lastTrailT(w), t);
      bringBuddies(w, t);
      setTime(w, t, nowMs);
      w.chloe.venuePrompt = null;
      w.beat = 3;
      return w;
    }
    case 4: {
      const s = c().session;
      // B3 is user-driven: any venue change Chloe made herself counts, however she typed or pinned it.
      // Only an untouched session (Director "next" without editing, or a jump/replay) is scripted.
      const scripted = !!s && s.venues.length < 2;
      if (scripted && s) w = editSession(w, { venue: 'Chupitos', returnMin: s.returnMin, buddies: s.buddies }, nowMs);
      const dest = c().session?.venuePos ?? CHUPITOS;
      const t0 = Math.max(lastTrailT(w), T(23, 0));
      walk(w, dest, t0, t0 + 4, 4);
      dwell(w, dest, t0 + 4, T(23, 10));
      bringBuddies(w, T(23, 10));
      setTime(w, T(23, 10), nowMs);
      w.chloe.venuePrompt = null;
      // B4 is user-driven (DESIGN §1.2): when you've set the venue yourself, logging is left to the
      // dual camera, so the drink isn't already there before you scan it.
      if (scripted && !c().drinks.some((d) => d.scanned))
        w = logDrink(w, { id: 'martini-b4', name: MARTINI.name, detail: `${MARTINI.size} · ~${MARTINI.abv}% ABV`, std: MARTINI.std, emoji: MARTINI.emoji, scanned: true }, nowMs);
      w.beat = 4;
      return w;
    }
    case 5: {
      const t = T(0, 0, true);
      dwell(w, c().pos, lastTrailT(w), t);
      setTime(w, t, nowMs);
      const sarah = w.buddies[SARAH.id];
      if (sarah) {
        sarah.pos = RESTROOM;
        sarah.withChloe = false;
        sarah.enRoute = false;
        sarah.okUntilMin = null;
        sarah.status = 'Restroom';
        sarah.updatedMin = t;
      }
      w.chloe.apartSinceMin = t;
      w.beat = 5;
      return w;
    }
    case 6: {
      const t = T(0, 30, true);
      dwell(w, c().pos, lastTrailT(w), t);
      setTime(w, t, nowMs);
      w = fireCheckIn(w, nowMs);
      w.beat = 6;
      return w;
    }
    case 7: {
      if (checkInOpen(c())) w = answerCheckInOk(w, nowMs);
      if (c().sos) w = cancelSos(w, nowMs);
      const t = T(0, 35, true);
      dwell(w, c().pos, lastTrailT(w), t);
      setTime(w, t, nowMs);
      const sarah = w.buddies[SARAH.id];
      if (sarah) {
        sarah.pos = beside(c().pos);
        sarah.withChloe = true;
        sarah.okUntilMin = null;
        sarah.status = null;
        sarah.updatedMin = t;
      }
      w.chloe.apartSinceMin = null;
      w.beat = 7;
      addEvent(w, { id: 'b7-u', to: ['user'], text: 'Sarah is back with you', tone: 'safe' }, nowMs);
      return w;
    }
    case 8: {
      const t = T(1, 45, true);
      dwell(w, c().pos, lastTrailT(w), t);
      setTime(w, t, nowMs);
      w.chloe.homeReminder = true;
      w.beat = 8;
      return w;
    }
    case 9: {
      w = enterRideQuote(w, nowMs);
      if (!c().ride) w = bookRide(w, ALL_AMENITIES, nowMs);
      w.beat = 9;
      return w;
    }
    case 10: {
      let guard = 0;
      while (c().ride && c().ride!.stage !== 'arrived' && guard++ < 6) w = advanceRide(w, nowMs);
      w.beat = 10;
      return w;
    }
  }
  return w;
}

/** Jump straight to beat `n`: replay B0..Bn with default user choices; intermediate events are not toasted. */
export function goToBeat(w0: World, n: number, nowMs = Date.now()): World {
  let w = applyBeat(w0, 0, nowMs);
  for (let i = 1; i <= n; i++) {
    if (i === n) w.events.forEach((e) => (e.replayed = true));
    w = applyBeat(w, i, nowMs);
  }
  if (n === 0) w.events = [];
  return w;
}

/** Director "Next beat": advance the ride stage while one is running, else apply the next beat. */
export function nextBeat(w0: World, nowMs = Date.now()): World {
  const c = w0.chloe;
  if (c.summary) return finishSummary(w0);
  if (c.arrival) return confirmArrival(w0, true, nowMs);
  if (c.ride && c.ride.stage !== 'arrived') return advanceRide(w0, nowMs);
  if (w0.beat >= 10) return w0;
  return applyBeat(w0, w0.beat + 1, nowMs);
}
