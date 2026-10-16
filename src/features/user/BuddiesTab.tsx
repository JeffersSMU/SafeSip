import { BatteryMedium, Lock, MapPin, Navigation, UserPlus } from 'lucide-react';
import { Avatar, Button, Header, StatusPill, cx, ui } from '../../components/ui';
import { CONTACTS, personById } from '../../data/cast';
import { useNow, useUi, useWorld } from '../../store';
import { agoLabel, fmtDay } from '../../store/time';
import { buddyBattery, buddyDistanceM, nowMin } from '../../store/world';
import { UserPill } from './common';
import s from './user.module.css';

export function BuddiesTab() {
  const now = useNow(5000);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const session = w.chloe.session;
  const inSession = session?.buddies ?? [];
  const rows = inSession.map((id) => ({ id, p: personById(id), b: w.buddies[id] })).filter((r) => r.b);
  const safe = rows.filter((r) => r.b.withChloe).length;
  const t = nowMin(w, now);

  return (
    <>
      <Header title="Buddies" subtitle={`Tonight · ${fmtDay(t)}`} pill={<UserPill />} />
      <div className={s.scroll}>
        {session ? (
          <>
            <h2 className={s.sectionTitle}>In your session</h2>
            <div className={s.strip} aria-label="Session summary">
              <StatusPill status="SAFE" label={`${safe} Safe`} />
              <StatusPill status="APART" label={`${rows.length - safe} Apart`} />
              <StatusPill status="MISSING" label="0 Missing" />
            </div>
            {rows.map(({ id, p, b }) => {
              const d = Math.round(buddyDistanceM(w, id, now) / 5) * 5;
              return (
                <button key={id} type="button" className={s.buddyRow} onClick={() => set({ sheet: { kind: 'person', id } })}>
                  <Avatar person={p} size={48} />
                  <span className={s.buddyMain}>
                    <span className={s.buddyName}>
                      {p.name}
                      <StatusPill status={b.withChloe ? 'SAFE' : 'APART'} label={b.withChloe ? 'With you' : `Apart · ${d} m`} />
                    </span>
                    <span className={s.metaRow}>
                      <span>
                        <MapPin size={14} aria-hidden /> {session.venue}
                      </span>
                      <span>Updated {agoLabel(b.updatedMin, t)}</span>
                      <span>
                        <BatteryMedium size={14} aria-hidden /> {buddyBattery(w, now)}%
                      </span>
                      <span style={{ color: 'var(--safe)' }}>
                        <Navigation size={14} aria-hidden /> Live
                      </span>
                    </span>
                    {b.status && <span className={s.quote}>“{b.status}”</span>}
                  </span>
                </button>
              );
            })}
          </>
        ) : (
          <div className={cx(ui.card, s.empty)}>
            <Navigation size={32} aria-hidden />
            <p>Start a Night Out to share live location with your Night Buddies.</p>
            <Button variant="primary" onClick={() => set({ userTab: 'map', modal: 'start' })}>
              Start Night Out
            </Button>
          </div>
        )}

        <h2 className={s.sectionTitle}>Contacts</h2>
        <div className={ui.card} style={{ paddingTop: 4, paddingBottom: 4 }}>
          {CONTACTS.filter((c) => !inSession.includes(c.id)).map((c) => (
            <div key={c.id} className={s.contactRow}>
              <Avatar person={c} size={42} />
              <span style={{ flex: 1, fontWeight: 650 }}>{c.name}</span>
              {session && (
                <Button variant="text" onClick={() => set({ modal: 'edit', editPreset: { addBuddy: c.id } })}>
                  <UserPlus size={18} /> Invite to session
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className={s.note}>
          <Lock size={16} style={{ flex: 'none', marginTop: 2 }} aria-hidden />
          Location is only shared with people in an active session with you.
        </p>
      </div>
    </>
  );
}
