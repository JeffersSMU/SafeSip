import { useEffect, useState } from 'react';
import { GlassWater, MapPin, User, Users } from 'lucide-react';
import { BottomNav, Banner, Button, cx, ui, type NavItem } from '../../components/ui';
import { dispatch, useUi, useWorld, type UserTab } from '../../store';
import { checkInOpen, dismissHomeReminder, dismissVenuePrompt } from '../../store/world';
import { fmtTime } from '../../store/time';
import { SosFab, openRide } from './common';
import { BuddiesTab } from './BuddiesTab';
import { CheckInModal } from './CheckIn';
import { DrinksTab } from './DrinksTab';
import { DualCamera } from './DualCamera';
import { MapTab } from './MapTab';
import { MeTab } from './MeTab';
import { PersonSheet } from './PersonSheet';
import { RideFlow } from './RideFlow';
import { EndSessionModal, SessionModal } from './SessionModals';
import { ArrivalModal, SummaryModal } from './Arrival';
import { SosFlow, SosSheet } from './Sos';
import s from './user.module.css';

const NAV: NavItem<UserTab>[] = [
  { key: 'map', label: 'Map', icon: <MapPin size={24} /> },
  { key: 'buddies', label: 'Buddies', icon: <Users size={24} /> },
  { key: 'drinks', label: 'Drinks', icon: <GlassWater size={24} /> },
  { key: 'me', label: 'Me', icon: <User size={24} /> },
];

/** Floating SOS: every User screen while a session is active (A3). */
function SosButton({ top, raised }: { top: boolean; raised: boolean }) {
  return <SosFab className={cx(top && s.sosTop, raised && s.sosRaised)} />;
}

export function UserShell() {
  const ui_ = useUi();
  const c = useWorld((w) => w.world.chloe);
  const tab = ui_.userTab;
  const sosVisible = !!c.sos && ui_.sosHiddenId !== c.sos.id;
  const rideOpen = ui_.fullscreen === 'rideQuote' || !!c.ride;
  // Visual shake paired with every vibration (iOS Safari can't vibrate: DESIGN §2.3).
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!ui_.shake) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 650);
    return () => window.clearTimeout(id);
  }, [ui_.shake]);

  return (
    <div className={cx(s.shell, shaking && ui.shake)}>
      <main className={s.content}>
        {tab === 'map' && <MapTab />}
        {tab === 'buddies' && <BuddiesTab />}
        {tab === 'drinks' && <DrinksTab />}
        {tab === 'me' && <MeTab />}
      </main>
      <BottomNav items={NAV} value={tab} onChange={(k) => ui_.set({ userTab: k })} />

      {ui_.fullscreen === 'camera' && <DualCamera />}
      {rideOpen && <RideFlow />}

      {c.venuePrompt && !checkInOpen(c) && (
        <Banner
          title={`Looks like you've moved to ${c.venuePrompt}.`}
          body="Update your venue so Helen and your Night Buddies know where you are?"
          actions={
            <>
              <Button variant="secondary" onClick={() => dispatch(dismissVenuePrompt)}>
                Not now
              </Button>
              <Button variant="primary" onClick={() => ui_.set({ modal: 'edit', editPreset: { venue: c.venuePrompt! } })}>
                Update
              </Button>
            </>
          }
        />
      )}
      {c.homeReminder && !c.ride && !checkInOpen(c) && (
        <Banner
          title={`Almost ${c.session ? fmtTime(c.session.returnMin) : '2:00 AM'} — time to head home?`}
          body="Book a ride back with care amenities, or get home yourself."
          actions={
            <>
              <Button variant="secondary" onClick={() => dispatch(dismissHomeReminder)}>
                Later
              </Button>
              <Button variant="ride" onClick={openRide}>
                Book a ride
              </Button>
            </>
          }
        />
      )}

      {(ui_.modal === 'start' || ui_.modal === 'edit') && <SessionModal mode={ui_.modal} />}
      {ui_.modal === 'end' && <EndSessionModal />}
      {ui_.sheet?.kind === 'person' && <PersonSheet id={ui_.sheet.id} />}
      {c.arrival && <ArrivalModal />}
      {c.summary && <SummaryModal />}
      {checkInOpen(c) && !c.sos && <CheckInModal />}

      {/* SOS is hidden on the ride booking screen (change request 15) and docked above the info panel for the whole booked ride (RideFlow). */}
      {c.session && !c.ride && ui_.fullscreen !== 'rideQuote' && (
        <SosButton top={rideOpen || ui_.fullscreen === 'camera'} raised={tab === 'map' && !rideOpen && !ui_.fullscreen} />
      )}
      {ui_.modal === 'sos' && !c.sos && <SosSheet />}
      {sosVisible && <SosFlow />}
    </div>
  );
}
