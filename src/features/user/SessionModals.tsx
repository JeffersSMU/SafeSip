import { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Car, Clock, Footprints, MapPin, Search, Star } from 'lucide-react';
import { DEST_ANCHOR, DEST_SIZE, MapView, destHtml, type MapMarker } from '../../components/MapView';
import { Avatar, Button, Modal, cx, ui } from '../../components/ui';
import { TimeWheel } from '../../components/TimeWheel';
import { CONTACTS } from '../../data/cast';
import { CLARKE_QUAY_MRT, VENUES, nearestVenue, type LatLng } from '../../data/places';
import { dispatch, useUi, useWorld } from '../../store';
import { fmtDay, fmtTime } from '../../store/time';
import { arrangeOwnRide, editSession, endSessionNow, nowMin, startSession } from '../../store/world';
import { openRide } from './common';
import s from './user.module.css';

type ListTab = 'recent' | 'favourites' | 'all';

/**
 * Session-scoped favourites, seeded from the cast data. Kept at module level so starred contacts
 * survive the modal closing and reopening; `favVersion` in the component triggers a re-render.
 */
const FAVOURITES = new Set(CONTACTS.filter((c) => c.favourite).map((c) => c.id));

/** "Tonight's Session" form shared by Start and Edit (DESIGN §5.2). */
export function SessionModal({ mode }: { mode: 'start' | 'edit' }) {
  const session = useWorld((w) => w.world.chloe.session);
  const simNowMin = useWorld((w) => nowMin(w.world));
  const { editPreset, set, toast } = useUi();
  const [favVersion, setFavVersion] = useState(0);
  const init = mode === 'edit' && session ? session : null;
  const [venue, setVenue] = useState(editPreset?.venue ?? init?.venue ?? '');
  const [venuePos, setVenuePos] = useState<LatLng | undefined>(init && !editPreset?.venue ? init.venuePos : undefined);
  const [picking, setPicking] = useState(false);
  const [venueFocus, setVenueFocus] = useState(false);
  // Default return time: 2 hours from now, rounded up to 5 minutes (change request 10).
  const [returnMin, setReturnMin] = useState(() => init?.returnMin ?? Math.ceil((simNowMin + 120) / 5) * 5);
  const [showWheel, setShowWheel] = useState(false);
  const todayIdx = Math.floor(simNowMin / 1440);
  const returnDay = Math.floor(returnMin / 1440);
  const returnTod = ((returnMin % 1440) + 1440) % 1440;
  const returnInPast = returnMin <= simNowMin;
  const [buddies, setBuddies] = useState<string[]>(() => {
    const base = init?.buddies ?? [];
    return editPreset?.addBuddy && !base.includes(editPreset.addBuddy) ? [...base, editPreset.addBuddy] : base;
  });
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<ListTab>('recent');

  const suggestions = venue.trim() && venueFocus ? VENUES.filter((v) => v.name.toLowerCase().includes(venue.trim().toLowerCase()) && v.name !== venue) : [];
  const list = useMemo(() => {
    const byTab = CONTACTS.filter((c) => (tab === 'recent' ? c.recent : tab === 'favourites' ? FAVOURITES.has(c.id) : true));
    const needle = q.trim().toLowerCase();
    return needle ? CONTACTS.filter((c) => c.name.toLowerCase().includes(needle)) : byTab;
  }, [q, tab, favVersion]);

  /** Star/unstar a contact. Adding shows a toast; the star state lives in the module-level set. */
  const toggleFavourite = (id: string, name: string) => {
    if (FAVOURITES.has(id)) {
      FAVOURITES.delete(id);
    } else {
      FAVOURITES.add(id);
      toast(`${name} has been added to Favourites`, 'safe');
    }
    setFavVersion((v) => v + 1);
  };

  const valid = venue.trim().length > 0 && buddies.length > 0 && !returnInPast;
  const close = () => set({ modal: null, editPreset: null });
  const submit = () => {
    const input = { venue: venue.trim(), venuePos, returnMin, buddies };
    if (mode === 'start') {
      dispatch((w, n) => startSession(w, input, n));
      set({ userTab: 'map' });
    } else dispatch((w, n) => editSession(w, input, n));
    close();
  };

  return (
    <>
    <Modal title={mode === 'start' ? "Tonight's Session" : 'Edit Session'} onClose={close}>
      <div className={s.form}>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="venue">
            Target location / venue
          </label>
          <input
            id="venue"
            className={ui.input}
            value={venue}
            placeholder="Search location"
            autoComplete="off"
            onFocus={() => setVenueFocus(true)}
            onChange={(e) => {
              setVenue(e.target.value);
              setVenuePos(undefined);
            }}
          />
          {suggestions.length > 0 && (
            <div className={s.suggest} role="listbox" aria-label="Venue suggestions">
              {suggestions.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setVenue(v.name);
                    setVenuePos(v.pos);
                    setVenueFocus(false);
                  }}
                >
                  <strong>{v.name}</strong>
                  <span className={cx(ui.muted, ui.small)}>{v.area}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="text" style={{ alignSelf: 'flex-start' }} onClick={() => setPicking(true)}>
            <MapPin size={16} /> Select from map
          </Button>
        </div>

        <div className={ui.field}>
          <span className={ui.label} id="ret-lbl">
            Estimated return
          </span>
          {/* Date + time together, so a session started at 11 PM can end at 2 AM the next day. */}
          <div className={s.dateTime} role="group" aria-labelledby="ret-lbl">
            <div className={s.dayChips} role="radiogroup" aria-label="Return date">
              {[todayIdx, todayIdx + 1].map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={returnDay === d}
                  className={cx(s.dayChip, returnDay === d && s.dayChipOn)}
                  onClick={() => setReturnMin(d * 1440 + returnTod)}
                >
                  <Calendar size={16} aria-hidden />
                  <span>
                    <span className={s.dayChipTop}>{d === todayIdx ? 'Today' : 'Tomorrow'}</span>
                    {fmtDay(d * 1440)}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className={s.timeBtn} aria-label={`Return time ${fmtTime(returnMin)}`} aria-expanded={showWheel} onClick={() => setShowWheel(!showWheel)}>
              <Clock size={20} aria-hidden /> {fmtTime(returnMin)}
              <span className={cx(ui.muted, ui.small)} style={{ marginLeft: 'auto', fontWeight: 500 }}>
                {showWheel ? 'Done' : 'Change'}
              </span>
            </button>
          </div>
          {showWheel && <TimeWheel value={returnTod} onChange={(tod) => setReturnMin(returnDay * 1440 + tod)} />}
          <p className={cx(ui.small, returnInPast ? s.fieldError : ui.muted)} aria-live="polite">
            {returnInPast ? 'Return time is in the past. Pick a later time or tomorrow.' : `Back by ${fmtDay(returnMin)}, ${fmtTime(returnMin)}`}
          </p>
        </div>

        <div className={ui.field}>
          <span className={ui.label}>Night Buddies</span>
          <div style={{ position: 'relative' }}>
            <Search size={18} aria-hidden style={{ position: 'absolute', left: 14, top: 17, color: 'var(--text-muted)' }} />
            <input className={ui.input} style={{ paddingLeft: 40 }} aria-label="Search contacts" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!q && (
            <div className={s.segTabs} role="tablist">
              {(['recent', 'favourites', 'all'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx(s.segTab, tab === t && s.segTabOn)} onClick={() => setTab(t)}>
                  {t === 'recent' ? 'Recent' : t === 'favourites' ? 'Favourites' : 'All contacts'}
                </button>
              ))}
            </div>
          )}
          <div>
            {list.map((c) => {
              const isFav = FAVOURITES.has(c.id);
              return (
                <div key={c.id} className={s.pickRow}>
                  <label className={s.pickMain}>
                    <input
                      type="checkbox"
                      checked={buddies.includes(c.id)}
                      onChange={(e) => setBuddies(e.target.checked ? [...buddies, c.id] : buddies.filter((b) => b !== c.id))}
                    />
                    <Avatar person={c} size={40} />
                    <span style={{ flex: 1, fontWeight: 650 }}>{c.name}</span>
                  </label>
                  <button
                    type="button"
                    className={cx(s.star, isFav && s.starOn)}
                    aria-pressed={isFav}
                    aria-label={isFav ? `Remove ${c.name} from Favourites` : `Add ${c.name} to Favourites`}
                    onClick={() => toggleFavourite(c.id, c.name)}
                  >
                    <Star size={22} fill={isFav ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                </div>
              );
            })}
            {list.length === 0 && <p className={cx(ui.muted, ui.small)}>No SafeSip contacts match.</p>}
          </div>
          <p className={cx(ui.muted, ui.small)}>Only contacts who use SafeSip are listed.</p>
        </div>

        <Button variant="primary" block disabled={!valid} onClick={submit}>
          {mode === 'start' ? "Let's go!" : 'Confirm Edits'}
        </Button>
      </div>
    </Modal>
    {picking && (
      <VenuePicker
        initial={venuePos}
        onCancel={() => setPicking(false)}
        onPick={(name, pos) => {
          setVenue(name);
          setVenuePos(pos);
          setPicking(false);
        }}
      />
    )}
    </>
  );
}

/** End Session confirms before routing to a ride (heuristic E4). */
export function EndSessionModal() {
  const set = useUi((u) => u.set);
  const close = () => set({ modal: null });
  return (
    <Modal title="End your Night Out?" onClose={close}>
      <p className={ui.muted} style={{ marginBottom: 16 }}>
        We'll let Helen know. Need a safe ride home?
      </p>
      <div className={s.form} style={{ gap: 10 }}>
        <Button variant="ride" block onClick={openRide}>
          <Car size={20} /> Book a ride back
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            dispatch(arrangeOwnRide);
            close();
          }}
        >
          <Footprints size={20} /> Get Home myself
        </Button>
        <Button
          variant="text"
          block
          onClick={() => {
            dispatch(endSessionNow);
            close();
          }}
        >
          End session now
        </Button>
      </div>
    </Modal>
  );
}


/**
 * "Select from map" (change request 9): tap a venue, or tap anywhere to drop a pin. A dropped pin is
 * named after the nearest listed venue (hardcoded data, no geocoding).
 */
function VenuePicker({ initial, onPick, onCancel }: { initial?: LatLng; onPick: (name: string, pos: LatLng) => void; onCancel: () => void }) {
  const [sel, setSel] = useState<{ name: string; pos: LatLng } | null>(() => {
    if (!initial) return null;
    const n = nearestVenue(initial);
    return { name: n.m < 40 ? n.venue.name : `Pinned spot near ${n.venue.name}`, pos: initial };
  });
  const markers: MapMarker[] = VENUES.filter((v) => v.name !== 'Clarke Quay').map((v) => ({
    id: v.name,
    pos: v.pos,
    html: destHtml(v.name, ''),
    size: DEST_SIZE,
    anchor: DEST_ANCHOR,
    label: `Choose ${v.name}`,
    onClick: () => setSel({ name: v.name, pos: v.pos }),
  }));
  if (sel) markers.push({ id: 'sel', pos: sel.pos, html: destHtml(sel.name, '· selected'), size: DEST_SIZE, anchor: DEST_ANCHOR, label: `Selected ${sel.name}`, z: 1000 });
  return (
    <div className={s.full} style={{ zIndex: 66 }} role="dialog" aria-modal="true" aria-label="Select target location from map">
      <div className={s.fullHead}>
        <button type="button" className={s.back} onClick={onCancel}>
          <ArrowLeft size={20} /> Back
        </button>
        <h1 className={s.fullTitle}>Select on map</h1>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView
          target={{ center: initial ?? CLARKE_QUAY_MRT, zoom: 17 }}
          viewKey="picker"
          markers={markers}
          onMapClick={(p) => {
            const n = nearestVenue(p);
            setSel(n.m < 40 ? { name: n.venue.name, pos: n.venue.pos } : { name: `Pinned spot near ${n.venue.name}`, pos: p });
          }}
        />
      </div>
      <div className={s.pickerBar}>
        <p className={cx(ui.muted, ui.small)}>{sel ? 'Meet-up point' : 'Tap a venue, or tap the map to drop a pin'}</p>
        <p style={{ fontWeight: 800, fontSize: 18, minHeight: 24 }}>{sel?.name ?? '—'}</p>
        <Button variant="primary" block disabled={!sel} onClick={() => sel && onPick(sel.name, sel.pos)}>
          Use this location
        </Button>
      </div>
    </div>
  );
}
