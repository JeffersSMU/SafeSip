import { useMemo, useState } from 'react';
import { Bell, Car, Clock, Footprints, MapPin, Search } from 'lucide-react';
import { Avatar, Button, Modal, cx, ui } from '../../components/ui';
import { TimeWheel } from '../../components/TimeWheel';
import { CONTACTS, HELEN } from '../../data/cast';
import { VENUES } from '../../data/places';
import { dispatch, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { DEFAULT_SESSION, arrangeOwnRide, editSession, endSessionNow, startSession } from '../../store/world';
import { openRide } from './common';
import s from './user.module.css';

type ListTab = 'recent' | 'favourites' | 'all';

/** "Tonight's Session" form shared by Start and Edit (DESIGN §5.2). */
export function SessionModal({ mode }: { mode: 'start' | 'edit' }) {
  const session = useWorld((w) => w.world.chloe.session);
  const { editPreset, set, toast } = useUi();
  const init = mode === 'edit' && session ? session : null;
  const [venue, setVenue] = useState(editPreset?.venue ?? init?.venue ?? '');
  const [venueFocus, setVenueFocus] = useState(false);
  const [returnMin, setReturnMin] = useState(init?.returnMin ?? DEFAULT_SESSION.returnMin);
  const [showWheel, setShowWheel] = useState(false);
  const [buddies, setBuddies] = useState<string[]>(() => {
    const base = init?.buddies ?? [];
    return editPreset?.addBuddy && !base.includes(editPreset.addBuddy) ? [...base, editPreset.addBuddy] : base;
  });
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<ListTab>('recent');

  const suggestions = venue.trim() && venueFocus ? VENUES.filter((v) => v.name.toLowerCase().includes(venue.trim().toLowerCase()) && v.name !== venue) : [];
  const list = useMemo(() => {
    const byTab = CONTACTS.filter((c) => (tab === 'recent' ? c.recent : tab === 'favourites' ? c.favourite : true));
    const needle = q.trim().toLowerCase();
    return needle ? CONTACTS.filter((c) => c.name.toLowerCase().includes(needle)) : byTab;
  }, [q, tab]);

  const valid = venue.trim().length > 0 && buddies.length > 0;
  const close = () => set({ modal: null, editPreset: null });
  const submit = () => {
    const input = { venue: venue.trim(), returnMin, buddies };
    if (mode === 'start') {
      dispatch((w, n) => startSession(w, input, n));
      set({ userTab: 'map' });
    } else dispatch((w, n) => editSession(w, input, n));
    close();
  };

  return (
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
            placeholder="Search a bar or club"
            autoComplete="off"
            onFocus={() => setVenueFocus(true)}
            onChange={(e) => setVenue(e.target.value)}
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
                    setVenueFocus(false);
                  }}
                >
                  <strong>{v.name}</strong>
                  <span className={cx(ui.muted, ui.small)}>{v.area}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="text" style={{ alignSelf: 'flex-start' }} onClick={() => toast('Pick on map isn’t part of this prototype')}>
            <MapPin size={16} /> Select from map
          </Button>
        </div>

        <div className={ui.field}>
          <span className={ui.label} id="ret-lbl">
            Estimated return time
          </span>
          <button type="button" className={s.timeBtn} aria-labelledby="ret-lbl" aria-expanded={showWheel} onClick={() => setShowWheel(!showWheel)}>
            <Clock size={20} aria-hidden /> {fmtTime(returnMin)}
            <span className={cx(ui.muted, ui.small)} style={{ marginLeft: 'auto', fontWeight: 500 }}>
              {showWheel ? 'Done' : 'Change'}
            </span>
          </button>
          {showWheel && <TimeWheel value={returnMin} onChange={setReturnMin} />}
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
            {list.map((c) => (
              <label key={c.id} className={s.pickRow}>
                <input
                  type="checkbox"
                  checked={buddies.includes(c.id)}
                  onChange={(e) => setBuddies(e.target.checked ? [...buddies, c.id] : buddies.filter((b) => b !== c.id))}
                />
                <Avatar person={c} size={40} />
                <span style={{ flex: 1, fontWeight: 650 }}>{c.name}</span>
              </label>
            ))}
            {list.length === 0 && <p className={cx(ui.muted, ui.small)}>No SafeSip contacts match.</p>}
          </div>
          <p className={cx(ui.muted, ui.small)}>Only contacts who use SafeSip are listed.</p>
        </div>

        <div className={s.notify}>
          <Bell size={18} aria-hidden />
          <span>
            Notifying: <strong>{HELEN.name} (Mother)</strong> will get a silent update
          </span>
        </div>

        <Button variant="primary" block disabled={!valid} onClick={submit}>
          {mode === 'start' ? "Let's go!" : 'Confirm Edits'}
        </Button>
      </div>
    </Modal>
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
          <Car size={20} /> Book a SafeSip ride
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            dispatch(arrangeOwnRide);
            close();
          }}
        >
          <Footprints size={20} /> Arrange my own ride
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
