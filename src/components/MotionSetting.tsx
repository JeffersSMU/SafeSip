import { Sparkles } from 'lucide-react';
import { useUi } from '../store';
import userCss from '../features/user/user.module.css';

/**
 * "Reduce motion" switch for the User and Watcher profile pages. Off by default unless the device asks
 * for reduced motion. Choosing the device's own value goes back to following the device.
 */
export function MotionSetting() {
  const choice = useUi((u) => u.reduceMotion);
  const system = useUi((u) => u.systemReducedMotion);
  const set = useUi((u) => u.set);
  const on = choice ?? system;
  const toggle = () => set({ reduceMotion: !on === system ? null : !on });
  return (
    <button type="button" className={userCss.setRow} role="switch" aria-checked={on} onClick={toggle}>
      <Sparkles size={20} aria-hidden />
      <span className={userCss.setLabel}>
        Reduce Motion
        <span className={userCss.setSub}>
          Turns off animations, moving pins and map fly-overs.{choice === null ? ' Following your device setting.' : ''}
        </span>
      </span>
      <span className={userCss.setValue} style={{ fontWeight: 700, color: on ? 'var(--safe)' : undefined }}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}
