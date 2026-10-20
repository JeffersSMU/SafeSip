import { GlassWater, MapPin, User, Users } from 'lucide-react';
import { BottomNav, Toasts, type NavItem } from '../components/ui';
import { useEventToasts, useAudioUnlock } from '../app/effects';
import { PhoneFrame } from '../app/PhoneFrame';
import { SosFab } from '../features/user/common';
import { MapTab } from '../features/user/MapTab';
import { PersonSheet } from '../features/user/PersonSheet';
import { SessionModal } from '../features/user/SessionModals';
import { useUi, type UserTab } from '../store';
import { T } from '../store/time';
import s from '../features/user/user.module.css';
import ab from './ab-testing.module.css';

const NAV: NavItem<UserTab>[] = [
  { key: 'map', label: 'Map', icon: <MapPin size={24} /> },
  { key: 'buddies', label: 'Buddies', icon: <Users size={24} /> },
  { key: 'drinks', label: 'Drinks', icon: <GlassWater size={24} /> },
  { key: 'me', label: 'Me', icon: <User size={24} /> },
];
const ignoreNavigation = () => {};

export function ABTestingApp() {
  const modal = useUi((u) => u.modal);
  const sheet = useUi((u) => u.sheet);
  const params = new URLSearchParams(location.search);
  const variant = params.get('variant') === 'b' ? 'b' : 'a';
  const result = location.pathname.includes('/success/') ? 'success' : location.pathname.includes('/unsuccessful/') ? 'unsuccessful' : null;
  useEventToasts();
  useAudioUnlock();

  const returnToTask = () => window.location.assign(`/a-b-testing/?variant=${variant}`);
  const finishEdit = ({ venue, returnMin }: { venue: string; returnMin: number }) => {
    const passed = venue.trim().toLowerCase() === 'chupitos' && returnMin === T(2, 30, true);
    const destination = passed ? 'success' : 'unsuccessful';
    window.location.assign(`/a-b-testing/${destination}/?variant=${variant}`);
  };

  if (result) {
    const success = result === 'success';
    return (
      <PhoneFrame showRecordingHelp={false}>
        <main className={ab.resultScreen}>
          <section className={ab.resultCard} aria-labelledby="result-title">
            <div className={`${ab.resultIcon} ${success ? ab.resultIconSuccess : ab.resultIconRetry}`} aria-hidden>
              {success ? '✓' : '↻'}
            </div>
            <h1 id="result-title">{success ? 'Well Done!' : 'Not Quite Right...'}</h1>
            <p>{success ? 'Perfect! You may now mark the task as completed.' : 'The modified session details do not match the task completely. Check the changed location and return time stated in the task, and try again.'}</p>
            {success && <button type="button" className={ab.backButton} onClick={returnToTask}>Back to SafeSip</button>}
          </section>
        </main>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame showRecordingHelp={false}>
      <div className={s.shell}>
        <main className={s.content}>
          <MapTab editOnly />
        </main>
        <BottomNav items={NAV} value="map" onChange={ignoreNavigation} />
        <SosFab className={s.sosRaised} inactive />
      </div>
      {modal === 'edit' && <SessionModal mode="edit" layout={variant === 'b' ? 'accordion' : 'expanded'} onEditSaved={finishEdit} />}
      {sheet?.kind === 'person' && <PersonSheet id={sheet.id} inactiveActions />}
      <Toasts />
    </PhoneFrame>
  );
}
