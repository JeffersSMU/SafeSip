import { useState } from 'react';
import { BellRing, MapPinned, Play, RotateCcw, SkipForward, UserCog, Wifi, WifiOff } from 'lucide-react';
import { Button, Modal, cx, ui } from '../../components/ui';
import { supabaseConfigured, normaliseRoom } from '../../store/sync';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { BEATS, fireCheckIn, goToBeat, moveWithoutEditing, nextBeat, nowMin } from '../../store/world';
import s from './director.module.css';

/**
 * Hidden Demo Director (DESIGN §7): fires the events a prototype can't sense. Opened by triple-tapping
 * the header status pill or pressing D. Never visible in recordings unless opened.
 */
export function Director() {
  useNow(1000);
  const w = useWorld((x) => x.world);
  const syncStatus = useWorld((x) => x.syncStatus);
  const { role, room, extraChild, set, login } = useUi();
  const [roomDraft, setRoomDraft] = useState(room);
  const close = () => set({ modal: null });
  const c = w.chloe;
  const nextLabel = c.summary
    ? 'Close summary'
    : c.arrival
      ? 'Confirm “Yes, I’m home”'
      : c.ride && c.ride.stage !== 'arrived'
        ? `Skip ride stage (${c.ride.stage})`
        : w.beat < 10
          ? `B${w.beat + 1}: ${BEATS[w.beat + 1].label}`
          : 'Scenario complete';

  return (
    <Modal title="Demo Director" onClose={close} zIndex={98}>
      <p className={cx(ui.muted, ui.small)}>
        Now <strong>B{w.beat}</strong> · {fmtTime(nowMin(w))} · {BEATS[w.beat].label}
      </p>

      <Button variant="primary" block style={{ marginTop: 12 }} onClick={() => dispatch(nextBeat)} disabled={w.beat >= 10 && !c.arrival && !c.summary}>
        <SkipForward size={18} /> {nextLabel}
      </Button>
      <div className={s.row}>
        <Button block onClick={() => dispatch(fireCheckIn)} disabled={!c.session}>
          <BellRing size={18} /> Fire check-in now
        </Button>
        <Button block onClick={() => dispatch((wd, n) => goToBeat(wd, 0, n))}>
          <RotateCcw size={18} /> Reset scenario
        </Button>
      </div>
      <Button block style={{ marginTop: 8 }} onClick={() => dispatch(moveWithoutEditing)} disabled={!c.session || !!c.ride}>
        <MapPinned size={18} /> Walk to another venue without editing (venue prompt)
      </Button>

      <h3 className={s.h}>Jump to beat</h3>
      <ol className={s.beats}>
        {BEATS.map((b) => (
          <li key={b.n}>
            <button
              type="button"
              className={cx(s.beat, b.n === w.beat && s.beatOn)}
              aria-current={b.n === w.beat ? 'step' : undefined}
              onClick={() => dispatch((wd, n) => goToBeat(wd, b.n, n))}
            >
              <span className={s.beatN}>B{b.n}</span>
              <span className={s.beatT}>{b.time}</span>
              <span className={s.beatL}>{b.label}</span>
              <Play size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <h3 className={s.h}>This device</h3>
      <div className={s.row}>
        <Button block variant={role === 'user' ? 'secondary' : 'plain'} onClick={() => login('user')}>
          <UserCog size={18} /> Chloe (User)
        </Button>
        <Button block variant={role === 'watcher' ? 'secondary' : 'plain'} onClick={() => login('watcher')}>
          <UserCog size={18} /> Helen (Watcher)
        </Button>
      </div>

      <h3 className={s.h}>Two-phone sync</h3>
      {supabaseConfigured ? (
        <>
          <form
            className={s.row}
            onSubmit={(e) => {
              e.preventDefault();
              set({ room: normaliseRoom(roomDraft) });
            }}
          >
            <input
              className={ui.input}
              aria-label="Room code"
              placeholder="Room code, e.g. G3T3"
              value={roomDraft}
              autoCapitalize="characters"
              onChange={(e) => setRoomDraft(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Join
            </Button>
          </form>
          <p className={cx(ui.small, s.status)}>
            {syncStatus === 'live' ? <Wifi size={16} aria-hidden /> : <WifiOff size={16} aria-hidden />}
            {room ? `Room ${room}: ${syncStatus}` : 'No room: this device only syncs with tabs in this browser.'}
          </p>
          <p className={cx(ui.muted, ui.small)}>Both phones: open the link with ?room=CODE (or join here) and pick a role each.</p>
        </>
      ) : (
        <p className={cx(ui.muted, ui.small)}>
          Supabase keys aren't set in this build, so sync only works between tabs in this browser. The Director still drives each phone on its own.
        </p>
      )}

      <h3 className={s.h}>Testing</h3>
      <label className={s.toggle}>
        <input type="checkbox" checked={extraChild} onChange={(e) => set({ extraChild: e.target.checked })} />
        <span>
          Add a demo second child to Helen
          <span className={cx(ui.muted, ui.small)} style={{ display: 'block' }}>
            Shows the multi-child switcher. Off for recordings: Chloe is Helen's only child.
          </span>
        </span>
      </label>
      <p className={cx(ui.muted, ui.small)} style={{ marginTop: 10 }}>
        Shortcuts: D toggles this sheet · → next beat · R reset · deep link ?role=user|watcher&amp;beat=B6&amp;room=G3T3
      </p>
    </Modal>
  );
}
