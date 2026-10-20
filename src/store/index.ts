import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { broadcastWorld, normaliseRoom, startSync, type SyncStatus } from './sync';
import { initialWorld, type World } from './world';

export type Role = 'user' | 'watcher';
export type UserTab = 'map' | 'buddies' | 'drinks' | 'me';
export type WatcherTab = 'map' | 'me';
export type ModalKind = 'start' | 'edit' | 'end' | 'sos' | 'director' | null;
export type FullScreen = 'camera' | 'rideQuote' | null;
export type Sheet = { kind: 'person'; id: string } | { kind: 'fare' } | { kind: 'payment' } | null;

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'safe' | 'warn' | 'danger';
}

/**
 * A logged drink's camera pair. `drink`/`selfie` are small thumbnails for lists;
 * `drinkRecap`/`selfieRecap` are mid-size captures used by the end-of-night recap
 * (optional so photos saved before this change still load).
 */
export interface PhotoPair {
  drink: string;
  selfie: string;
  drinkRecap?: string;
  selfieRecap?: string;
}

const AB_TEST_MODE = location.pathname.startsWith('/a-b-testing');
const WORLD_KEY = AB_TEST_MODE ? 'safesip.ab-testing.world.v1' : 'safesip.world.v2';
const UI_KEY = AB_TEST_MODE ? 'safesip.ab-testing.ui.v1' : 'safesip.ui.v1';
const PHOTOS_KEY = AB_TEST_MODE ? 'safesip.ab-testing.photos.v1' : 'safesip.photos.v1';

function load<V>(key: string, fallback: V): V {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : fallback;
  } catch {
    return fallback;
  }
}

const deviceId = (() => {
  const k = 'safesip.device';
  let id = localStorage.getItem(k);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem(k, id);
  }
  return id;
})();

// ---------- world store (synced) ----------

interface WorldStore {
  world: World;
  syncStatus: SyncStatus;
  lastUserPeerMs: number;
  /** Apply a pure transition; a null/identical result is a no-op. */
  dispatch: (fn: (w: World, nowMs: number) => World | null) => void;
  receive: (w: World) => void;
}

let maxSeenRev = 0;

export const useWorld = create<WorldStore>((set, get) => ({
  world: load<World>(WORLD_KEY, initialWorld()),
  syncStatus: 'off',
  lastUserPeerMs: 0,
  dispatch: (fn) => {
    const cur = get().world;
    const next = fn(cur, Date.now());
    if (!next || next === cur) return;
    // Outrank anything seen from peers, so a reset on a lagging phone still wins.
    next.rev = Math.max(cur.rev, maxSeenRev) + 1;
    maxSeenRev = next.rev;
    next.by = deviceId;
    set({ world: next });
    localStorage.setItem(WORLD_KEY, JSON.stringify(next));
    broadcastWorld(next);
  },
  receive: (w) => {
    const cur = get().world;
    maxSeenRev = Math.max(maxSeenRev, w.rev);
    if (w.rev > cur.rev || (w.rev === cur.rev && w.by > cur.by)) {
      set({ world: w });
      localStorage.setItem(WORLD_KEY, JSON.stringify(w));
    }
  },
}));

export const dispatch = (fn: (w: World, nowMs: number) => World | null) => useWorld.getState().dispatch(fn);

// ---------- local UI store (never synced) ----------

interface UiPersisted {
  role: Role | null;
  room: string;
  extraChild: boolean;
  checkInInterval: number;
  quietUpdates: boolean;
  /** Reduce motion: true/false once the person picks one; null follows the device setting. */
  reduceMotion: boolean | null;
}

interface UiStore extends UiPersisted {
  /** Live `prefers-reduced-motion` of this device (not persisted). */
  systemReducedMotion: boolean;
  authScreen: 'login' | 'signup';
  userTab: UserTab;
  watcherTab: WatcherTab;
  modal: ModalKind;
  fullscreen: FullScreen;
  sheet: Sheet;
  editPreset: { venue?: string; addBuddy?: string } | null;
  toasts: Toast[];
  shake: number;
  watcherSelected: string;
  ackEmergency: string | null;
  /** SOS flow closed with X: the alert stays active, the full-screen flow is hidden. */
  sosHiddenId: string | null;
  /** Watcher's non-silent notification banner. */
  notice: { id: string; title: string; body: string } | null;
  photos: Record<string, PhotoPair>;  set: (p: Partial<UiStore>) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  login: (role: Role) => void;
  logout: () => void;
}

const UI_DEFAULTS: UiPersisted = { role: null, room: '', extraChild: false, checkInInterval: 30, quietUpdates: true, reduceMotion: null };
const persisted: UiPersisted = { ...UI_DEFAULTS, ...load<Partial<UiPersisted>>(UI_KEY, {}) };

const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function initialParams() {
  const q = new URLSearchParams(location.search);
  const role = q.get('role');
  const room = q.get('room');
  return {
    role: role === 'user' || role === 'watcher' ? (role as Role) : undefined,
    room: room !== null ? normaliseRoom(room) : undefined,
    beat: q.get('beat'),
    tab: q.get('tab'),
  };
}

export const startParams = initialParams();

export const useUi = create<UiStore>((set, get) => ({
  ...persisted,
  role: startParams.role ?? persisted.role,
  room: startParams.room ?? persisted.room,
  systemReducedMotion: motionQuery?.matches ?? false,
  authScreen: 'login',
  // Deep link ?tab=map|buddies|drinks|me (User) or map|me (Watcher), for testing and screenshots.
  userTab: (['map', 'buddies', 'drinks', 'me'].includes(startParams.tab ?? '') ? startParams.tab : 'map') as UserTab,
  watcherTab: (startParams.tab === 'me' ? 'me' : 'map') as WatcherTab,
  modal: null,
  fullscreen: null,
  sheet: null,
  editPreset: null,
  toasts: [],
  shake: 0,
  watcherSelected: 'chloe',
  ackEmergency: null,
  sosHiddenId: null,
  notice: null,
  photos: load(PHOTOS_KEY, {}),
  set: (p) => set(p),
  toast: (text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] });
    window.setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200);
  },
  login: (role) => set({ role, userTab: 'map', watcherTab: 'map', modal: null, fullscreen: null, sheet: null }),
  logout: () => set({ role: null, authScreen: 'login', modal: null, fullscreen: null, sheet: null }),
}));

useUi.subscribe((s) => {
  const p: UiPersisted = {
    role: s.role,
    room: s.room,
    extraChild: s.extraChild,
    checkInInterval: s.checkInInterval,
    quietUpdates: s.quietUpdates,
    reduceMotion: s.reduceMotion,
  };
  localStorage.setItem(UI_KEY, JSON.stringify(p));
  applyMotionAttr();
});

// ---------- reduced motion ----------

/** Whether motion is reduced right now: the person's choice, else the device's prefers-reduced-motion. */
export function motionReduced() {
  const u = useUi.getState();
  return u.reduceMotion ?? u.systemReducedMotion;
}

/** React hook form of motionReduced(), re-rendering when either the setting or the device flag changes. */
export function useReducedMotion() {
  return useUi((u) => u.reduceMotion ?? u.systemReducedMotion);
}

/** CSS switches every animation off via html[data-motion='reduce'] (global.css). */
function applyMotionAttr() {
  document.documentElement.dataset.motion = motionReduced() ? 'reduce' : 'full';
}
applyMotionAttr();
motionQuery?.addEventListener('change', (e) => useUi.setState({ systemReducedMotion: e.matches }));

// Mid-size recap images (~640px) are far smaller than full captures, so a night's worth fits.
const PHOTO_CAP = 20;

export function savePhotos(id: string, drink: string, selfie: string, drinkRecap?: string, selfieRecap?: string) {
  const photos: Record<string, PhotoPair> = { ...useUi.getState().photos, [id]: { drink, selfie, drinkRecap, selfieRecap } };
  // Keep only the newest pairs so localStorage never overflows.
  const keys = Object.keys(photos);
  for (const k of keys.slice(0, Math.max(0, keys.length - PHOTO_CAP))) delete photos[k];
  useUi.setState({ photos });
  persistPhotos(photos);
}

/** Persist photos, shedding the oldest pair on quota errors so the newest still survive a reload. */
function persistPhotos(photos: Record<string, PhotoPair>) {
  let entries = Object.entries(photos);
  while (entries.length > 0) {
    try {
      localStorage.setItem(PHOTOS_KEY, JSON.stringify(Object.fromEntries(entries)));
      return;
    } catch {
      entries = entries.slice(1);
    }
  }
  try {
    localStorage.removeItem(PHOTOS_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- sync wiring ----------

export function connectSync(room: string) {
  startSync(
    {
      deviceId,
      getWorld: () => useWorld.getState().world,
      onWorld: (w) => useWorld.getState().receive(w),
      onStatus: (s) => useWorld.setState({ syncStatus: s }),
      onPeer: (role) => {
        if (role === 'user') useWorld.setState({ lastUserPeerMs: Date.now() });
      },
      getRole: () => useUi.getState().role,
    },
    room,
  );
}

// Other tabs in this browser write localStorage too; pick that up as a fallback path.
window.addEventListener('storage', (e) => {
  if (e.key === WORLD_KEY && e.newValue) {
    try {
      useWorld.getState().receive(JSON.parse(e.newValue) as World);
    } catch {
      /* ignore malformed */
    }
  }
});

// ---------- hooks ----------

/** Re-render on an interval; returns the current epoch ms. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export { deviceId };
