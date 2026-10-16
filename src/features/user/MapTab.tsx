import { Car, Clock, MapPin, Pencil, Power } from 'lucide-react';
import { MapView, homeHtml, pinHtml, venueHtml, type MapMarker } from '../../components/MapView';
import { Button, Header, STATUS_COLOR, cx } from '../../components/ui';
import { CHLOE, personById } from '../../data/cast';
import { HOME, venuePos } from '../../data/places';
import { useNow, useUi, useWorld } from '../../store';
import { fmtDuration, fmtTime } from '../../store/time';
import { chloeBattery, buddyBattery, chloePos, nowMin, userWellbeing } from '../../store/world';
import { UserPill, openRide } from './common';
import s from './user.module.css';

export function MapTab() {
  const now = useNow(1000);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const c = w.chloe;
  const session = c.session;
  const me = chloePos(w, now);
  const status = userWellbeing(w, now);

  const markers: MapMarker[] = [];
  if (session) {
    const vp = venuePos(session.venue);
    markers.push({ id: 'venue', pos: vp, html: venueHtml(session.venue), size: [1, 1], anchor: [0, 0], label: `Venue ${session.venue}`, z: -100 });
    for (const id of session.buddies) {
      const b = w.buddies[id];
      if (!b) continue;
      const p = personById(id);
      markers.push({
        id,
        pos: b.pos,
        label: `${p.name}, ${b.withChloe ? 'safe' : 'apart'}`,
        html: pinHtml({ initials: p.initials, color: p.color, ring: b.withChloe ? STATUS_COLOR.SAFE : STATUS_COLOR.APART, battery: buddyBattery(w, now) }),
        onClick: () => set({ sheet: { kind: 'person', id } }),
      });
    }
  } else {
    markers.push({ id: 'home', pos: HOME, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: 'Home', z: -100 });
  }
  markers.push({
    id: 'me',
    pos: me,
    label: `You, ${status.toLowerCase()}`,
    z: 1000,
    html: pinHtml({ initials: CHLOE.initials, color: CHLOE.color, ring: session ? STATUS_COLOR[status] : '#ffffff', battery: chloeBattery(w, now), pulse: !!session }),
    onClick: () => set({ sheet: { kind: 'person', id: 'chloe' } }),
  });

  const fit = session ? markers.filter((m) => m.id !== 'venue').map((m) => m.pos) : [me];
  const viewKey = `${!!session}-${me[0].toFixed(4)}-${w.beat}-${session?.buddies.map((b) => w.buddies[b]?.withChloe).join()}`;
  const now_ = nowMin(w, now);

  return (
    <>
      <Header
        title="Map"
        subtitle={session ? `Tonight at ${session.venue}` : 'Your location'}
        pill={<UserPill />}
      />
      <div className={s.mapWrap}>
        <div className={s.mapFill}>
          <MapView target={session ? { fit, maxZoom: 18 } : { center: me, zoom: 15 }} viewKey={viewKey} markers={markers} />
        </div>
        {session && (
          <div className={s.legend} aria-label="Legend">
            <span className={s.legendTitle}>Legend</span>
            {(['SAFE', 'APART', 'MISSING'] as const).map((k) => (
              <span key={k} className={s.legendRow}>
                <span className={s.legendDot} style={{ background: STATUS_COLOR[k] }} aria-hidden />
                {k === 'SAFE' ? 'Safe' : k === 'APART' ? 'Apart' : 'Missing'}
              </span>
            ))}
          </div>
        )}
        <div className={cx(s.mapBottom, session && s.mapBottomActive)}>
          {session ? (
            <>
              <div className={s.sessionCard}>
                <span className={s.sessionVenue}>
                  <MapPin size={18} aria-hidden /> {session.venue}
                </span>
                <div className={s.metaRow}>
                  <span>
                    <Clock size={14} aria-hidden /> Back by {fmtTime(session.returnMin)}
                  </span>
                  <span>Out for {fmtDuration(now_ - session.startMin)}</span>
                  <span>Now {fmtTime(now_)}</span>
                </div>
                <Button variant="ride" className={s.getHome} onClick={openRide}>
                  <Car size={18} /> Get home safely
                </Button>
              </div>
              <div className={s.btnRow}>
                <Button variant="secondary" block onClick={() => set({ modal: 'edit', editPreset: null })}>
                  <Pencil size={18} /> Edit Session
                </Button>
                <Button variant="dangerOutline" block onClick={() => set({ modal: 'end' })}>
                  <Power size={18} /> End Session
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
