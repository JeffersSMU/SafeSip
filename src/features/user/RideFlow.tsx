import { useState, type ReactNode } from 'react';
import { ArrowLeft, Car, Check, ChevronRight, CreditCard, Info, MessageSquare, Phone, Share2, Star } from 'lucide-react';
import { MapView, homeHtml, pinHtml, venueHtml, type MapMarker, type MapViewTarget } from '../../components/MapView';
import { Button, LinkButton, Modal, cx, ui } from '../../components/ui';
import { CHLOE } from '../../data/cast';
import { DRIVER_APPROACH, DROPOFFS, PICKUPS, type RidePoint } from '../../data/places';
import { AMENITY_INFO, BAND_LABEL, BASE_FARE, PER_KM, PER_MIN, PLATFORM_FEE, driversOffering, money, type Amenities } from '../../data/pricing';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import {
  ALL_AMENITIES,
  RIDE_STAGE_MS,
  bookRide,
  cancelRide,
  dropById,
  nowMin,
  pickupById,
  quoteNow,
  rideKm,
  ridePositions,
  rideRoute,
  type Ride,
} from '../../store/world';
import { SosFab } from './common';
import r from './ride.module.css';
import s from './user.module.css';

const DRIVER = { name: 'Ahmad R.', rating: 4.9, car: 'Toyota Prius', plate: 'SMB1234X', phone: '+65 8123 4567' };

function FareSheet({ amenities, km, onClose }: { amenities: Amenities; km: number; onClose: () => void }) {
  const w = useWorld((x) => x.world);
  const q = quoteNow(w, amenities, km);
  const rows: [string, string][] = [
    ['Base fare', money(BASE_FARE)],
    [`Distance ${q.km} km × ${money(PER_KM)}`, money(PER_KM * q.km)],
    [`Time ${q.minutes} min × ${money(PER_MIN)}`, money(PER_MIN * q.minutes)],
    ['Metered', money(q.metered)],
    [BAND_LABEL[q.band], money(q.banded)],
    ['Platform fee', money(PLATFORM_FEE)],
    ['Care amenities', money(q.amenities)],
  ];
  return (
    <Modal title="Fare details" onClose={onClose} zIndex={70}>
      <dl className={r.fareTable}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div className={r.fareTotal}>
          <dt>Upfront fare</dt>
          <dd>{money(q.total)}</dd>
        </div>
      </dl>
    </Modal>
  );
}

function PaymentSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Payment method" onClose={onClose} zIndex={70}>
      {['Visa •••• 4321', 'GrabPay', 'Cash'].map((m, i) => (
        <button key={m} type="button" className={s.setRow} onClick={onClose} aria-pressed={i === 0}>
          <CreditCard size={20} aria-hidden />
          <span className={s.setLabel}>{m}</span>
          {i === 0 && <Check size={20} color="var(--brand)" aria-label="selected" />}
        </button>
      ))}
    </Modal>
  );
}

/** Pick a pickup or drop-off point from the hardcoded list (change request 15). */
function PointSheet({ title, points, value, onPick, onClose }: { title: string; points: RidePoint[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} zIndex={70}>
      {points.map((p) => (
        <button
          key={p.id}
          type="button"
          className={s.setRow}
          aria-pressed={p.id === value}
          onClick={() => {
            onPick(p.id);
            onClose();
          }}
        >
          <span className={s.setLabel}>
            {p.name}
            <span className={s.setSub}>{p.area}</span>
          </span>
          {p.id === value && <Check size={20} color="var(--brand)" aria-label="selected" />}
        </button>
      ))}
    </Modal>
  );
}

function RideHeader({ title, onBack, partner = true }: { title: string; onBack?: () => void; partner?: boolean }) {
  return (
    <div className={s.fullHead}>
      {onBack && (
        <button type="button" className={s.back} onClick={onBack}>
          <ArrowLeft size={20} /> Back
        </button>
      )}
      <h1 className={s.fullTitle}>{title}</h1>
      {partner}
    </div>
  );
}

function Quote() {
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  useNow(5000);
  const [am, setAm] = useState<Amenities>(ALL_AMENITIES);
  const [pickupId, setPickupId] = useState('chupitos');
  const [dropId, setDropId] = useState('home');
  const [sheet, setSheet] = useState<'fare' | 'pay' | 'pickup' | 'drop' | null>(null);
  const km = rideKm(pickupId, dropId);
  const q = quoteNow(w, am, km);
  const pick = pickupById(pickupId);
  const drop = dropById(dropId);
  const route = rideRoute(pickupId, dropId);
  const close = () => set({ fullscreen: null });
  const ticked = AMENITY_INFO.filter((a) => am[a.key]).length;
  const markers: MapMarker[] = [
    { id: 'pick', pos: pick.pos, html: venueHtml(`Pickup · ${pick.name}`), size: [1, 1], anchor: [0, 0], label: `Pickup ${pick.name}` },
    { id: 'drop', pos: drop.pos, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: `Drop-off ${drop.name}` },
  ];
  return (
    <div className={s.full}>
      <RideHeader title="Get Home Safely" onBack={close} partner={false} />
      <div className={cx(r.map, r.mapTall)}>
        <MapView attribution="top-left" target={{ fit: route, maxZoom: 15 }} viewKey={`quote-${pickupId}-${dropId}`} markers={markers} zoomControls lines={[{ id: 'route', points: route, color: '#00A651' }]} />
      </div>
      <div className={cx(r.panel, r.panelCompact)}>
        <p className={r.grabNote}>
          <Info size={14} aria-hidden /> SafeSip is partnered with Grab™ to deliver a safe and reliable ride back home
        </p>
        <button type="button" className={r.pointRow} onClick={() => setSheet('pickup')} aria-label={`Pickup ${pick.name}. Change pickup point`}>
          <span className={r.routeDot} style={{ background: 'var(--ride)' }} aria-hidden />
          <span style={{ flex: 1 }}>
            <strong>{pick.name}</strong> <span className={ui.muted}>· {pick.area}</span>
          </span>
          <span className={r.link}>Change</span>
        </button>
        <button type="button" className={r.pointRow} onClick={() => setSheet('drop')} aria-label={`Drop-off ${drop.name}. Change drop-off point`}>
          <span className={r.routeDot} style={{ background: 'var(--text)' }} aria-hidden />
          <span style={{ flex: 1 }}>
            <strong>{drop.name}</strong> <span className={ui.muted}>· {drop.area}</span>
          </span>
          <span className={r.routeMeta}>
            {km} km · {q.minutes} min
          </span>
          <span className={r.link}>Change</span>
        </button>

        <fieldset className={r.amenityChips}>
          <legend>
            Care amenities <span className={ui.muted}>· {driversOffering(am)} drivers {ticked ? (ticked === 3 ? 'offer all 3' : 'offer these') : 'nearby'}</span>
          </legend>
          {AMENITY_INFO.map((a) => (
            <label key={a.key} className={cx(r.amenityChip, am[a.key] && r.amenityChipOn)}>
              <input type="checkbox" checked={am[a.key]} onChange={(e) => setAm({ ...am, [a.key]: e.target.checked })} />
              {a.label} +{money(a.price)}
            </label>
          ))}
        </fieldset>

        <div className={r.fareLine}>
          <button type="button" className={r.fareRow} onClick={() => setSheet('fare')} aria-label={`Fare ${money(q.total)}. Show fare details`}>
            <span>
              <span className={r.fare}>{money(q.total)}</span>
              <span className={cx(ui.muted, ui.small)} style={{ display: 'block' }}>
                Upfront · {q.band === 'late' ? 'late-night ×1.5' : q.band === 'peak' ? 'peak ×1.25' : 'standard'} <ChevronRight size={12} aria-hidden style={{ verticalAlign: -1 }} />
              </span>
            </span>
          </button>
          <button type="button" className={r.payChip} onClick={() => setSheet('pay')}>
            <CreditCard size={16} aria-hidden /> Visa •••• 4321 <ChevronRight size={14} aria-hidden />
          </button>
        </div>

        <Button variant="ride" block onClick={() => dispatch((wd, n) => bookRide(wd, am, n, pickupId, dropId))} disabled={!w.chloe.session}>
          Book Ride
        </Button>
      </div>
      {sheet === 'fare' && <FareSheet amenities={am} km={km} onClose={() => setSheet(null)} />}
      {sheet === 'pay' && <PaymentSheet onClose={() => setSheet(null)} />}
      {sheet === 'pickup' && <PointSheet title="Pickup point" points={PICKUPS} value={pickupId} onPick={setPickupId} onClose={() => setSheet(null)} />}
      {sheet === 'drop' && <PointSheet title="Drop-off point" points={DROPOFFS} value={dropId} onPick={setDropId} onClose={() => setSheet(null)} />}
    </div>
  );
}

function DriverCard({ ride, onCancel }: { ride: Ride; onCancel: () => void }) {
  return (
    <div className={r.driver}>
      <div className={ui.row}>
        <span className={r.driverAvatar} aria-hidden>
          AR
        </span>
        <span style={{ flex: 1 }}>
          <strong style={{ display: 'block' }}>{DRIVER.name}</strong>
          <span className={cx(ui.muted, ui.small)}>
            <Star size={13} fill="currentColor" aria-hidden style={{ verticalAlign: -1 }} /> {DRIVER.rating} · {DRIVER.car}
          </span>
        </span>
        <span className={r.plate}>{DRIVER.plate}</span>
      </div>
      <div className={r.badges}>
        {AMENITY_INFO.filter((a) => ride.amenities[a.key]).map((a) => (
          <span key={a.key} className={r.badge}>
            <Check size={14} aria-hidden /> {a.short}
          </span>
        ))}
      </div>
      <div className={s.btnRow}>
        <LinkButton variant="secondary" href={`tel:${DRIVER.phone.replace(/\s/g, '')}`}>
          <Phone size={18} /> Call
        </LinkButton>
        <LinkButton variant="secondary" href={`sms:${DRIVER.phone.replace(/\s/g, '')}`}>
          <MessageSquare size={18} /> Message
        </LinkButton>
      </div>
      <Button variant="text" block onClick={onCancel}>
        Cancel booking
      </Button>
    </div>
  );
}

function Booked({ ride }: { ride: Ride }) {
  const now = useNow(250);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pos = ridePositions(ride, now);
  const t = nowMin(w, now);
  const pick = pickupById(ride.pickupId);
  const drop = dropById(ride.dropId);
  const cancel = () => {
    dispatch(cancelRide);
    set({ fullscreen: 'rideQuote' });
    setConfirmCancel(false);
  };

  const onTrip = ride.stage === 'trip' || ride.stage === 'arrived';
  const markers: MapMarker[] = [];
  const lines = [{ id: 'route', points: pos.route, color: '#00A651', opacity: 0.35 }];
  if (onTrip) lines.push({ id: 'done', points: pos.path, color: '#00A651', opacity: 1 });
  markers.push({ id: 'drop', pos: drop.pos, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: drop.name });
  if (!onTrip) markers.push({ id: 'me', pos: pick.pos, html: pinHtml({ self: true, initials: CHLOE.initials, tone: 'safe', name: 'You · pickup' }), label: 'You' });
  if (ride.stage !== 'matching')
    markers.push({
      id: 'car',
      pos: pos.car,
      html: pinHtml({ initials: '', tone: 'safe', car: true, name: onTrip ? 'You · on your way' : DRIVER.name, chip: DRIVER.plate }),
      label: 'Driver',
      z: 1000,
    });

  // On the way home the whole journey stays in view (change request 16).
  const target: MapViewTarget = onTrip ? { fit: pos.route, maxZoom: 15 } : { fit: [...DRIVER_APPROACH.slice(0, -1), pick.pos], maxZoom: 17 };
  const viewKey = onTrip ? `trip-${ride.id}` : `${ride.stage}-${ride.id}`;

  const stageMin = ride.pickupMin - t;
  const where = drop.id === 'home' ? 'home' : drop.name;
  let title = '';
  let body: ReactNode = null;
  switch (ride.stage) {
    case 'matching':
      title = 'Finding a driver…';
      body = (
        <>
          <div className={r.radar} aria-hidden>
            <Car className={r.radarCar} size={40} />
          </div>
          <div className={r.badges} style={{ justifyContent: 'center' }}>
            {AMENITY_INFO.filter((a) => ride.amenities[a.key]).map((a) => (
              <span key={a.key} className={r.badge}>
                {a.label}
              </span>
            ))}
          </div>
          <p className={ui.muted} style={{ textAlign: 'center' }}>
            Matching Grab drivers who offer your care amenities...
          </p>
          <Button variant="secondary" block onClick={cancel}>
            Cancel
          </Button>
        </>
      );
      break;
    case 'found':
    case 'arriving':
      title = ride.stage === 'found' ? 'Driver found' : 'Driver arriving';
      body = (
        <>
          <p className={r.eta}>
            Arriving in {Math.max(1, Math.ceil(stageMin))} min{' '}
            <span className={cx(ui.muted, ui.small)} style={{ fontWeight: 500 }}>
              · pickup {fmtTime(ride.pickupMin)} at {pick.name}
            </span>
          </p>
          <DriverCard ride={ride} onCancel={() => setConfirmCancel(true)} />
          {ride.stage === 'found' && (
            <p className={cx(ui.muted, ui.small)} style={{ textAlign: 'center' }}>
              Free cancellation for 2 min
            </p>
          )}
        </>
      );
      break;
    case 'trip':
    case 'arrived':
      title = `On your way ${drop.id === 'home' ? 'home' : `to ${drop.name}`}`;
      body = (
        <>
          <p className={r.eta}>
            Arriving {where} ~{fmtTime(ride.etaMin)}
          </p>
          <div className={r.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos.progress * 100)} aria-label="Trip progress">
            <span style={{ width: `${pos.progress * 100}%` }} />
          </div>
          <p className={cx(ui.muted, ui.small)}>
            {Math.max(0, Math.round(ride.etaMin - t))} min left · {DRIVER.name} · {DRIVER.plate} · Helen can see your trip
          </p>
          <Button variant="secondary" block onClick={() => useUi.getState().toast('Trip link copied (prototype)')}>
            <Share2 size={18} /> Share trip
          </Button>
        </>
      );
      break;
  }

  return (
    <div className={s.full}>
      <RideHeader title={title} />
      <div className={r.map}>
        <MapView attribution="top-left" target={target} viewKey={viewKey} markers={markers} zoomControls lines={onTrip ? lines : []} insets={{ top: 10, bottom: 20 }} />
      </div>
      <div className={r.panelWrap}>
        {/* SOS sits bottom-right just above the info panel for every booked stage (change request 7). */}
        <SosFab className={r.sosDock} />
        <div className={r.panel} aria-live="polite">
          {body}
        </div>
      </div>
      {confirmCancel && (
        <Modal title="Cancel this booking?" onClose={() => setConfirmCancel(false)} zIndex={70}>
          <p className={ui.muted} style={{ marginBottom: 16 }}>
            {ride.stage === 'found' && now - ride.stageMs < RIDE_STAGE_MS.found + 120000 ? 'Free cancellation: no charge.' : 'Your driver is on the way.'} You'll go back to booking.
          </p>
          <div className={s.btnRow}>
            <Button variant="secondary" block onClick={() => setConfirmCancel(false)}>
              Keep ride
            </Button>
            <Button variant="danger" block onClick={cancel}>
              Cancel booking
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Grab-partnered ride flow (DESIGN §5.8). The booking lives in the synced world so Helen sees it. */
export function RideFlow() {
  const ride = useWorld((x) => x.world.chloe.ride);
  return ride ? <Booked ride={ride} /> : <Quote />;
}
