import { useEffect, useRef } from 'react';
import { connectSync, dispatch, startParams, useUi, useWorld } from '../store';
import { escalateCheckIn, goToBeat, nextBeat, tickApart, tickRide } from '../store/world';
import { playAlarm, playChime, unlockAudio, vibrate } from './sound';

/** Show toasts for new scenario events addressed to this device's role. */
export function useEventToasts() {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    seen.current = new Set(useWorld.getState().world.events.map((e) => e.id));
    return useWorld.subscribe((st) => {
      const role = useUi.getState().role;
      const set = seen.current!;
      for (const e of st.world.events) {
        if (set.has(e.id)) continue;
        set.add(e.id);
        if (e.replayed || !role || Date.now() - e.ms > 30000) continue;
        if (role === 'user' && e.vibrate) {
          vibrate();
          useUi.setState((u) => ({ shake: u.shake + 1 }));
          playChime();
        }
        if (!e.to.includes(role) || !e.text) continue;
        // The Watcher's emergency alerts get a full-screen takeover instead of a toast.
        if (role === 'watcher' && e.loud && e.tone === 'danger') continue;
        if (role === 'watcher' && e.loud) {
          // Non-silent notification (e.g. session start, change request 11): banner + sound, not a toast.
          playChime();
          vibrate([300, 150, 300]);
          useUi.getState().set({ notice: { id: e.id, title: e.title ?? 'SafeSip', body: e.text } });
          continue;
        }
        if (role === 'watcher' && !e.loud && !useUi.getState().quietUpdates) continue;
        useUi.getState().toast(e.text, e.tone);
      }
    });
  }, []);
}

/**
 * Automatic triggers: ride stage timing, check-in escalation, the 30-minute apart rule.
 * Runs on the User's phone; a Watcher device only runs it when no User device is reachable,
 * so two phones never race to write the same transition.
 */
export function useAutoWriter() {
  useEffect(() => {
    const id = window.setInterval(() => {
      const role = useUi.getState().role;
      const { lastUserPeerMs } = useWorld.getState();
      const userPeerAlive = Date.now() - lastUserPeerMs < 10000;
      if (!role || (role === 'watcher' && userPeerAlive)) return;
      const interval = useUi.getState().checkInInterval;
      dispatch(tickRide);
      dispatch(escalateCheckIn);
      dispatch((w, n) => tickApart(w, n, interval));
    }, 500);
    return () => window.clearInterval(id);
  }, []);
}

/** Sync connection follows the room code. */
export function useSync() {
  const room = useUi((u) => u.room);
  useEffect(() => {
    connectSync(room);
  }, [room]);
}

/** Desktop shortcuts (DESIGN §7): D opens the Director, → next beat, R resets. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !useUi.getState().role) return;
      if (e.key === 'd' || e.key === 'D') useUi.getState().set({ modal: useUi.getState().modal === 'director' ? null : 'director' });
      else if (e.key === 'ArrowRight') dispatch(nextBeat);
      else if (e.key === 'r' || e.key === 'R') dispatch((w, n) => goToBeat(w, 0, n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** `?beat=B6` deep link, applied once on load. */
export function useDeepLinkBeat() {
  useEffect(() => {
    const m = /^B?(\d{1,2})$/i.exec(startParams.beat ?? '');
    if (m) {
      const n = Math.min(10, Number(m[1]));
      dispatch((w, now) => goToBeat(w, n, now));
    }
  }, []);
}

/** Unlock audio on the first tap anywhere (browser autoplay rules). */
export function useAudioUnlock() {
  useEffect(() => {
    const f = () => unlockAudio();
    window.addEventListener('pointerdown', f, { once: true });
    window.addEventListener('keydown', f, { once: true });
    return () => {
      window.removeEventListener('pointerdown', f);
      window.removeEventListener('keydown', f);
    };
  }, []);
}

export { playAlarm };
