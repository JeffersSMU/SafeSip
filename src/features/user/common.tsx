import { Phone } from 'lucide-react';
import { SessionPill, cx } from '../../components/ui';
import { dispatch, useUi, useWorld } from '../../store';
import { enterRideQuote } from '../../store/world';
import s from './user.module.css';

/** Header pill for every User tab: session status + hidden Director trigger. */
export function UserPill() {
  const active = useWorld((w) => !!w.world.chloe.session);
  return <SessionPill active={active} label={active ? 'Active: Night Out session, location shared' : 'Inactive: no Night Out session'} />;
}

/** Open the ride booking flow (from the B9 reminder, End Session, or the map card). */
export function openRide() {
  dispatch(enterRideQuote);
  useUi.getState().set({ fullscreen: 'rideQuote', modal: null, sheet: null });
}

/** The red SOS button. Position comes from `className` (shell float, or docked above a panel). */
export function SosFab({ className, inactive = false }: { className?: string; inactive?: boolean }) {
  const sos = useWorld((w) => w.world.chloe.sos);
  const set = useUi((u) => u.set);
  return (
    <button
      type="button"
      className={cx(s.sos, sos && s.sosActive, className)}
      aria-label={sos ? 'SOS alert active, open it' : 'SOS emergency'}
      onClick={() => { if (!inactive) set(sos ? { sosHiddenId: null } : { modal: 'sos' }); }}
    >
      <Phone size={20} aria-hidden />
      SOS
    </button>
  );
}
