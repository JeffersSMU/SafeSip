import { GlassWater, MapPin, User, Users } from 'lucide-react';
import { BottomNav, Toasts, type NavItem } from '../components/ui';
import { useEventToasts, useAudioUnlock } from '../app/effects';
import { PhoneFrame } from '../app/PhoneFrame';
import { SosFab } from '../features/user/common';
import { MapTab } from '../features/user/MapTab';
import { PersonSheet } from '../features/user/PersonSheet';
import { SessionModal } from '../features/user/SessionModals';
import { useUi, type UserTab } from '../store';
import s from '../features/user/user.module.css';

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
  const variant = new URLSearchParams(location.search).get('variant') === 'b' ? 'b' : 'a';
  useEventToasts();
  useAudioUnlock();

  return (
    <PhoneFrame showRecordingHelp={false}>
      <div className={s.shell}>
        <main className={s.content}>
          <MapTab editOnly />
        </main>
        <BottomNav items={NAV} value="map" onChange={ignoreNavigation} />
        <SosFab className={s.sosRaised} inactive />
      </div>
      {modal === 'edit' && <SessionModal mode="edit" layout={variant === 'b' ? 'accordion' : 'expanded'} />}
      {sheet?.kind === 'person' && <PersonSheet id={sheet.id} inactiveActions />}
      <Toasts />
    </PhoneFrame>
  );
}
