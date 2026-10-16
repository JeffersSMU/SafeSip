import { AlertTriangle, CheckCircle2, Home, MapPin, ShieldAlert } from 'lucide-react';
import { DEST_ANCHOR, DEST_SIZE, MapView, PIN_ANCHOR_TOP, destHtml, homeHtml, pinHtml, type MapMarker, type PinTone } from '../../components/MapView';
import { Button, Header } from '../../components/ui';
import { CHLOE, personById } from '../../data/cast';
import { HOME, distanceM } from '../../data/places';
import { useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { buddyBattery, buddyView, chloeBattery, chloePos, nowMin, trail60, userWellbeing, type Wellbeing } from '../../store/world';
import { UserPill } from './common';
import s from './user.module.css';

const TONE: Record<Wellbeing, PinTone> = { SAFE: 'safe', APART: 'apart', MISSING: 'missing', SOS: 'sos' };
const WORD: Record<Wellbeing, string> = { SAFE: 'Safe', APART: 'Apart', MISSING: 'Missing', SOS: 'SOS' };

/** Space the overlays cover, so fitting keeps pins visible. */
const INSETS_ACTIVE = { top: 48, bottom: 170 };
const INSETS_IDLE = { top: 48, bottom: 80 };

export function MapTab() {
  const now = useNow(1000);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const c = w.chloe;
  const session = c.session;
  const me = chloePos(w, now);
  const myStatus = userWellbeing(w, now);
  const t = nowMin(w, now);

  const people: Wellbeing[] = [];
  const markers: MapMarker[] = [];
  if (session) {
    // Target / meet-up point (B1) and the new destination after an edit (B3). Hidden once she's there.
    const atTarget = distanceM(me, session.venuePos) < 40;
    const caption = session.venues.length > 1 ? '· new destination' : '· meet-up point';
    if (!atTarget)
      markers.push({ id: `dest-${session.venue}`, pos: session.venuePos, html: destHtml(session.venue, caption), size: DEST_SIZE, anchor: DEST_ANCHOR, label: `${session.venue} ${caption.replace('· ', '')}`, z: -200 });
    for (const id of session.buddies) {
      const b = w.buddies[id];
      if (!b) continue;
      const p = personById(id);
      const v = buddyView(w, id, now);
      people.push(v.status);
      // A buddy close to Chloe gets its label above the pin, so the two labels never overlap.
      const close = v.d < 90;
      // Buddy chip: no distance — "with you", "On the way", or just the status word.
      const chip = b.withChloe ? `${WORD[v.status]} · with you` : b.enRoute ? 'On the way' : WORD[v.status];
      markers.push({
        id,
        pos: b.pos,
        anchor: close ? PIN_ANCHOR_TOP : undefined,
        label: `${p.name}, ${v.label}, battery ${buddyBattery(w, now)}%`,
        html: pinHtml({ initials: p.initials, tone: TONE[v.status], name: `${p.short} · ${buddyBattery(w, now)}%`, chip, labelTop: close }),
        onClick: () => set({ sheet: { kind: 'person', id } }),
      });
    }
    people.push(myStatus);
  }
  if (!session || distanceM(me, HOME) > 50) {
    markers.push({ id: 'home', pos: HOME, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: 'Home', z: -100 });
  }
  markers.push({
    id: 'me',
    pos: me,
    z: 1000,
    label: `You, ${session ? WORD[myStatus] : 'no session'}, battery ${chloeBattery(w, now)}%`,
    html: pinHtml({
      self: true,
      initials: CHLOE.initials,
      tone: session ? TONE[myStatus] : 'brand',
      name: `You · ${chloeBattery(w, now)}%`,
      chip: session ? WORD[myStatus] : undefined,
      pulse: !!session,
    }),
    onClick: () => set({ sheet: { kind: 'person', id: 'chloe' } }),
  });

  const trail = session ? trail60(w, now) : [];
  const fit = session ? markers.filter((m) => m.id !== 'home').map((m) => m.pos) : [me];
  const viewKey = `${!!session}-${me[0].toFixed(4)}-${w.beat}-${session?.venue}-${session?.buddies.map((b) => `${w.buddies[b]?.pos[0].toFixed(4)}`).join()}`;
  const count = (st: Wellbeing[]) => people.filter((p) => st.includes(p)).length;
  const rows = [
    { key: 'safe', label: 'Safe', n: count(['SAFE']), icon: <CheckCircle2 size={16} aria-hidden />, color: 'var(--safe)', always: true },
    { key: 'apart', label: 'Apart', n: count(['APART']), icon: <AlertTriangle size={16} aria-hidden />, color: 'var(--warn)' },
    { key: 'missing', label: 'Missing', n: count(['MISSING', 'SOS']), icon: <ShieldAlert size={16} aria-hidden />, color: 'var(--danger)' },
  ].filter((r) => r.always || r.n > 0);

  return (
    <>
      <Header title="Map" pill={<UserPill />} />
      <div className={s.mapWrap}>
        <div className={s.mapFill}>
          <MapView
            target={session ? { fit, maxZoom: 18 } : { center: me, zoom: 15 }}
            viewKey={viewKey}
            markers={markers}
            lines={trail.length > 1 ? [{ id: 'trail', points: trail, dashed: true, weight: 4, color: '#5B3DF5', opacity: 0.8 }] : []}
            insets={session ? INSETS_ACTIVE : INSETS_IDLE}
            zoomControls
          />
        </div>

        {/* Venue, current scenario time and return time (change request 1). */}
        <p className={s.venueChip} aria-live="polite">
          {session ? <MapPin size={14} aria-hidden /> : <Home size={14} aria-hidden />}
          <strong>{session ? session.venue : 'Home'}</strong>
          <span>
            · {fmtTime(t)}
            {session && <span className={s.venueChipMuted}>, return by {fmtTime(session.returnMin)}</span>}
          </span>
        </p>

        <div className={s.mapBottom}>
          {session ? (
            <>
              {/* Doubles as the map legend (heuristic C2): colour + icon + label + count. */}
              <div className={s.counts} role="group" aria-label="Legend: who is safe, apart or missing">
                {rows.map((r) => (
                  <span key={r.key} className={s.countRow} style={{ color: r.color }}>
                    {r.icon}
                    <span className={s.countLabel}>{r.label}</span>
                    <span className={s.countN} style={{ background: r.color }}>
                      {r.n}
                    </span>
                  </span>
                ))}
              </div>
              <div className={s.btnRow}>
                <Button variant="secondary" block className={s.editBtn} onClick={() => set({ modal: 'edit', editPreset: null })}>
                  Edit Session
                </Button>
                <Button variant="primary" block onClick={() => set({ modal: 'end' })}>
                  End Session
                </Button>
              </div>
            </>
          ) : (
            <Button variant="primary" block onClick={() => set({ modal: 'start' })}>
              Start Night Out
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
