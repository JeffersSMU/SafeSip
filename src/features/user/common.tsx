import { SessionPill } from '../../components/ui';
import { dispatch, useUi, useWorld } from '../../store';
import { enterRideQuote } from '../../store/world';

/** Header pill for every User tab: session status + hidden Director trigger. */
export function UserPill() {
  const active = useWorld((w) => !!w.world.chloe.session);
  return <SessionPill active={active} onLabel="Session Active – Tracking On" offLabel="No active session" />;
}

/** Open the ride booking flow (from the B8 reminder, End Session, or the map card). */
export function openRide() {
  dispatch(enterRideQuote);
  useUi.getState().set({ fullscreen: 'rideQuote', modal: null, sheet: null });
}
