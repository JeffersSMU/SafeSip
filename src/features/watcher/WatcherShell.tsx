import { useEffect, useRef } from 'react';
import { MapPin, Siren, User } from 'lucide-react';
import { BottomNav, Button, LinkButton, type NavItem } from '../../components/ui';
import { useNow, useUi, useWorld, type WatcherTab } from '../../store';
import { playAlarm, vibrate } from '../../app/sound';
import { childView, linkedIds } from './children';
import { WatcherMap } from './WatcherMap';
import { WatcherMe } from './WatcherMe';
import s from './watcher.module.css';

const NAV: NavItem<WatcherTab>[] = [
  { key: 'map', label: 'Map', icon: <MapPin size={24} /> },
  { key: 'me', label: 'Me', icon: <User size={24} /> },
];

/** Full-screen non-silent alert when a child becomes MISSING or SOS (shown once per emergency). */
function EmergencyTakeover() {
  const now = useNow(500);
  const w = useWorld((x) => x.world);
  const { extraChild, ackEmergency, set } = useUi();
  const views = linkedIds(extraChild).map((id) => childView(id, w, now));
  const v = views.find((x) => x.emergency && x.emergency !== ackEmergency);
  const played = useRef<string | null>(null);

  useEffect(() => {
    if (v?.emergency && played.current !== v.emergency) {
      played.current = v.emergency;
      playAlarm();
      vibrate([600, 200, 600, 200, 600]);
    }
  }, [v?.emergency]);

  if (!v) return null;
  const sos = v.status === 'SOS';
  const ack = () => set({ ackEmergency: v.emergency, watcherSelected: v.person.id, watcherTab: 'map' });
  return (
    <div className={s.alert} role="alertdialog" aria-modal="true" aria-labelledby="em-title" aria-describedby="em-body">
      <span className={s.alertIcon} aria-hidden>
        <Siren size={52} />
      </span>
      <h2 id="em-title" className={s.alertTitle}>
        {sos ? `${v.person.short} sent an SOS` : `${v.person.short} isn't responding`}
      </h2>
      <p id="em-body" className={s.alertBody}>
        {sos ? `She asked for help at ${v.session?.venue}. Her live location is on your map.` : `She missed a well-being check-in at ${v.session?.venue}. Sarah has been alerted too.`}
      </p>
      <Button block className={s.alertWhite} onClick={ack}>
        <MapPin size={20} /> View on map
      </Button>
      <LinkButton block className={s.alertGhost} href="tel:999" onClick={ack}>
        <Siren size={20} /> Emergency Call · 999
      </LinkButton>
    </div>
  );
}

export function WatcherShell() {
  const tab = useUi((u) => u.watcherTab);
  const set = useUi((u) => u.set);
  return (
    <div className={s.shell}>
      <main className={s.content}>{tab === 'map' ? <WatcherMap /> : <WatcherMe />}</main>
      <BottomNav items={NAV} value={tab} onChange={(k) => set({ watcherTab: k })} />
      <EmergencyTakeover />
    </div>
  );
}
