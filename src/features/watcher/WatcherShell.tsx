import { useEffect, useRef } from 'react';
import { MapPin, Siren, User } from 'lucide-react';
import { Banner, BottomNav, Button, LinkButton, type NavItem } from '../../components/ui';
import { useNow, useUi, useWorld, type WatcherTab } from '../../store';
import { playAlarm, vibrate } from '../../app/sound';
import { childView, linkedIds } from './children';
import { WatcherMap } from './WatcherMap';
import { WatcherMe } from './WatcherMe';
import { OnboardingTour } from '../onboarding/OnboardingTour';
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
      if (useUi.getState().onboarding?.role === 'watcher') useUi.getState().finishOnboarding();
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

/** Non-silent notification banner (session start, "Chloe is safe"); auto-hides after 8 s. */
function NoticeBanner() {
  const notice = useUi((u) => u.notice);
  const set = useUi((u) => u.set);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => set({ notice: null }), 8000);
    return () => window.clearTimeout(id);
  }, [notice, set]);
  if (!notice) return null;
  return (
    <Banner
      title={notice.title}
      body={notice.body}
      actions={
        <>
          <Button variant="secondary" onClick={() => set({ notice: null })}>
            Dismiss
          </Button>
          <Button variant="primary" onClick={() => set({ notice: null, watcherTab: 'map' })}>
            View
          </Button>
        </>
      }
    />
  );
}

export function WatcherShell() {
  const tab = useUi((u) => u.watcherTab);
  const set = useUi((u) => u.set);
  const notice = useUi((u) => u.notice);
  return (
    <div className={s.shell}>
      <main key={tab} className={s.content}>{tab === 'map' ? <WatcherMap /> : <WatcherMe />}</main>
      <BottomNav items={NAV} value={tab} onChange={(k) => set({ watcherTab: k })} />
      <NoticeBanner />
      <EmergencyTakeover />
      <OnboardingTour role="watcher" suspended={!!notice} />
    </div>
  );
}
