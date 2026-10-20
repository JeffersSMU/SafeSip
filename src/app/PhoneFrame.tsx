import { useEffect, useState, type ReactNode } from 'react';
import { BatteryMedium, Signal, Wifi } from 'lucide-react';
import { useNow, useWorld } from '../store';
import { fmtClock } from '../store/time';
import { nowMin } from '../store/world';
import s from './app.module.css';

const query = '(min-width: 600px) and (hover: hover) and (pointer: fine)';

function useDesktop() {
  const [d, setD] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setD(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return d;
}

function StatusBar() {
  useNow(1000);
  const w = useWorld((x) => x.world);
  return (
    <div className={s.statusBar} aria-hidden>
      <span>{fmtClock(nowMin(w))}</span>
      <span className={s.island} />
      <span className={s.statusIcons}>
        <Signal size={16} />
        <Wifi size={16} />
        <BatteryMedium size={20} />
      </span>
    </div>
  );
}

/**
 * Phones: full screen. Desktop: centred 390×844 frame whose status bar shows the simulated time,
 * so desktop recordings show the scenario clock (DESIGN §2.4).
 */
export function PhoneFrame({ children, showRecordingHelp = true }: { children: ReactNode; showRecordingHelp?: boolean }) {
  const desktop = useDesktop();
  if (!desktop) return <div className={s.phone}>{children}</div>;
  return (
    <div className={s.desktop}>
      <div className={s.wrap}>
        <div className={s.frame}>
          <div className={s.screen}>
            <StatusBar />
            <div className={s.app}>{children}</div>
          </div>
        </div>
        {showRecordingHelp && <aside className={s.side}>
          <strong style={{ color: 'var(--text)' }}>Recording shortcuts</strong>
          <span>
            <kbd>D</kbd> Demo Director · <kbd>→</kbd> next beat · <kbd>R</kbd> reset
          </span>
          <span>Or triple-tap the status pill under the page title.</span>
          <span>Open a second tab as Helen (username “helen”) to watch both sides sync.</span>
        </aside>}
      </div>
    </div>
  );
}
