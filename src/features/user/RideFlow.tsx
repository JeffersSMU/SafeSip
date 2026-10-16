import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, CreditCard, MessageSquare, Phone, Share2, Star } from 'lucide-react';
import { MapView, homeHtml, pinHtml, venueHtml, type MapMarker, type MapViewTarget } from '../../components/MapView';
import { Button, LinkButton, Modal, cx, ui } from '../../components/ui';
import { CHLOE } from '../../data/cast';
import { CHUPITOS, DRIVER_APPROACH, HOME, ROUTE_HOME, ROUTE_HOME_KM } from '../../data/places';
import { AMENITY_INFO, BAND_LABEL, BASE_FARE, PER_KM, PER_MIN, PLATFORM_FEE, driversOffering, money, type Amenities } from '../../data/pricing';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { ALL_AMENITIES, RIDE_STAGE_MS, arrangeOwnRide, bookRide, cancelRide, nowMin, quoteNow, ridePositions, type Ride } from '../../store/world';
import r from './ride.module.css';
import s from './user.module.css';

const DRIVER = { name: 'Ahmad R.', rating: 4.9, car: 'Toyota Prius', plate: 'SMB1234X', phone: '+65 8123 4567' };

function FareSheet({ amenities, onClose }: { amenities: Amenities; onClose: () => void }) {
  const w = useWorld((x) => x.world);
  const q = quoteNow(w, amenities);
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
      <p className={cx(ui.muted, ui.small)} style={{ marginTop: 12 }}>
        Time bands follow LTA's taxi peak and late-night surcharge periods. Rates are a realistic estimate based on public reports of Grab's Singapore pricing, not Grab's actual formula.
      </p>
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

function RideHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className={s.fullHead}>
      {onBack && (
        <button type="button" className={s.back} onClick={onBack}>
          <ArrowLeft size={20} /> Back
        </button>
      )}
      <h1 className={s.fullTitle}>{title}</h1>
      <span className={r.partner}>SafeSip Ride · in partnership with Grab</span>
    </div>
  );
}

function Quote() {
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  useNow(5000);
  const [am, setAm] = useState<Amenities>(ALL_AMENITIES);
  const [sheet, setSheet] = useState<'fare' | 'pay' | null>(null);
  const q = quoteNow(w, am);
  const close = () => set({ fullscreen: null });
  const markers: MapMarker[] = [
    { id: 'pick', pos: CHUPITOS, html: venueHtml('Pickup · Chupitos'), size: [1, 1], anchor: [0, 0], label: 'Pickup Chupitos' },
    { id: 'drop', pos: HOME, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: 'Home, Yishun' },
  ];
  return (
    <div className={s.full}>
      <RideHeader title="Get Home Safely" onBack={close} />
      <div className={r.map}>
        <MapView target={{ fit: ROUTE_HOME, maxZoom: 13 }} viewKey="quote" markers={markers} lines={[{ id: 'route', points: ROUTE_HOME, color: '#00A651' }]} />
      </div>
      <div className={r.panel}>
        <div className={r.routeRow}>
          <span className={r.routeDot} style={{ background: 'var(--ride)' }} aria-hidden />
          <span>
            <strong>Chupitos</strong> <span className={ui.muted}>· Clarke Quay</span>
          </span>
        </div>
        <div className={r.routeRow}>
          <span className={r.routeDot} style={{ background: 'var(--text)' }} aria-hidden />
          <span>
            <strong>Home</strong> <span className={ui.muted}>· Yishun</span>
          </span>
          <span className={r.routeMeta}>
            {ROUTE_HOME_KM} km · {q.minutes} min
          </span>
        </div>

        <fieldset className={r.amenities}>
          <legend>Care amenities</legend>
          {AMENITY_INFO.map((a) => (
            <label key={a.key} className={r.amenity}>
              <input type="checkbox" checked={am[a.key]} onChange={(e) => setAm({ ...am, [a.key]: e.target.checked })} />
              <span style={{ flex: 1 }}>{a.label}</span>
              <span className={ui.muted}>+{money(a.price)}</span>
            </label>
          ))}
          <p className={cx(ui.muted, ui.small)}>
            {driversOffering(am)} drivers nearby{' '}
            {AMENITY_INFO.filter((a) => am[a.key]).length ? `offer ${AMENITY_INFO.filter((a) => am[a.key]).length === 3 ? 'all 3' : 'these'}` : 'available'}
          </p>
        </fieldset>

        <button type="button" className={r.fareRow} onClick={() => setSheet('fare')} aria-label={`Fare ${money(q.total)}. Show fare details`}>
          <span>
            <span className={r.fare}>{money(q.total)}</span>
            <span className={cx(ui.muted, ui.small)} style={{ display: 'block' }}>
              Upfront fare · {q.band === 'late' ? 'late-night ×1.5' : q.band === 'peak' ? 'peak ×1.25' : 'standard'}
            </span>
          </span>
          <span className={r.link}>
            Fare details <ChevronRight size={16} />
          </span>
        </button>
        <button type="button" className={r.payRow} onClick={() => setSheet('pay')}>
          <CreditCard size={20} aria-hidden /> <span style={{ flex: 1 }}>Visa •••• 4321</span>
          <ChevronRight size={18} aria-hidden />
        </button>

        <Button variant="ride" block onClick={() => dispatch((wd, n) => bookRide(wd, am, n))} disabled={!w.chloe.session}>
          Book SafeSip Ride
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            dispatch(arrangeOwnRide);
            close();
          }}
        >
          Arrange my own ride
        </Button>
      </div>
      {sheet === 'fare' && <FareSheet amenities={am} onClose={() => setSheet(null)} />}
      {sheet === 'pay' && <PaymentSheet onClose={() => setSheet(null)} />}
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
  const cancel = () => {
    dispatch(cancelRide);
    set({ fullscreen: 'rideQuote' });
    setConfirmCancel(false);
  };

  const markers: MapMarker[] = [];
  const lines = [{ id: 'route', points: ROUTE_HOME, color: '#00A651', opacity: 0.35 }];
  if (ride.stage === 'trip') lines.push({ id: 'done', points: pos.path, color: '#00A651', opacity: 1 });
  markers.push({ id: 'home', pos: HOME, html: homeHtml(), size: [28, 28], anchor: [14, 14], label: 'Home' });
  if (ride.stage !== 'trip') markers.push({ id: 'me', pos: CHUPITOS, html: pinHtml({ initials: CHLOE.initials, color: CHLOE.color, ring: 'var(--safe)' }), label: 'You' });
  if (ride.stage !== 'matching') markers.push({ id: 'car', pos: pos.car, html: pinHtml({ initials: '', color: 'var(--ride)', ring: '#fff', car: true }), label: 'Driver', z: 1000 });

  const target: MapViewTarget = ride.stage === 'trip' ? { center: pos.car, zoom: 14 } : { fit: [...DRIVER_APPROACH, CHUPITOS], maxZoom: 17 };
  const viewKey = ride.stage === 'trip' ? `trip-${Math.floor(pos.progress * 10)}` : ride.stage;

  const stageMin = (ride.pickupMin - t);
  let title = '';
  let body: ReactNode = null;
  switch (ride.stage) {
    case 'matching':
      title = 'Finding your driver…';
      body = (
        <>
          <div className={r.radar} aria-hidden>
            <span />
            <span />
          </div>
          <div className={r.badges} style={{ justifyContent: 'center' }}>
            {AMENITY_INFO.filter((a) => ride.amenities[a.key]).map((a) => (
              <span key={a.key} className={r.badge}>
                {a.label}
              </span>
            ))}
          </div>
          <p className={ui.muted} style={{ textAlign: 'center' }}>
            Matching drivers who offer your care amenities · {money(ride.fare.total)}
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
              · pickup {fmtTime(ride.pickupMin)} at Chupitos
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
      title = 'On your trip';
      body = (
        <>
          <p className={r.eta}>Arriving home ~{fmtTime(ride.etaMin)}</p>
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
        <MapView target={target} viewKey={viewKey} markers={markers} lines={ride.stage === 'trip' ? lines : []} />
      </div>
      <div className={r.panel} aria-live="polite">
        {body}
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
