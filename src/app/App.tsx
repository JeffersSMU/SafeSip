import { Toasts } from '../components/ui';
import { Auth } from '../features/auth/Auth';
import { Director } from '../features/director/Director';
import { UserShell } from '../features/user/UserShell';
import { WatcherShell } from '../features/watcher/WatcherShell';
import { useUi } from '../store';
import { useAudioUnlock, useAutoWriter, useDeepLinkBeat, useEventToasts, useShortcuts, useSync } from './effects';
import { PhoneFrame } from './PhoneFrame';

export function App() {
  const role = useUi((u) => u.role);
  const modal = useUi((u) => u.modal);
  useSync();
  useEventToasts();
  useAutoWriter();
  useShortcuts();
  useDeepLinkBeat();
  useAudioUnlock();

  return (
    <PhoneFrame>
      {role === null && <Auth />}
      {role === 'user' && <UserShell />}
      {role === 'watcher' && <WatcherShell />}
      <Toasts />
      {modal === 'director' && <Director />}
    </PhoneFrame>
  );
}
