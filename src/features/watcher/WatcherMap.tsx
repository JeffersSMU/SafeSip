import { useEffect, useState } from 'react';
import { AlertTriangle, Car, MessageSquare, Phone, Siren } from 'lucide-react';
import { DEST_ANCHOR, DEST_SIZE, MapView, destHtml, pinHtml, type MapLine, type MapMarker, type PinTone } from '../../components/MapView';
import { Avatar, Button, Header, LinkButton, Modal, STATUS_COLOR, SessionPill, StatusPill, cx, ui } from '../../components/ui';
import { useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { nowMin, ridePositions } from '../../store/world';
import { telHref, smsHref } from '../user/PersonSheet';
import { childView, linkedIds, rankChildren, type ChildView } from './children';
import s from './watcher.module.css';

const SG_CENTER: [number, number] = [1.3521, 103.8198];
const TONE: Record<string, PinTone> = { SAFE: 'safe', MISSING: 'missing', SOS: 'sos', OUT: 'brand' };

function fadingTrail(points: [number, number][]): MapLine[] {
  if (points.length < 2) return [];
  const chunks = 4;
  const size = Math.ceil(points.length / chunks);
  const out: MapLine[] = [];
  for (let i = 0; i < chunks; i++) {
    const seg = points.slice(Math.max(0, i * size - 1), (i + 1) * size);
    if (seg.length >= 2) out.push({ id: `trail-${i}`, points: seg, dashed: true, weight: 4, color: '#5B3DF5', opacity: 0.25 + (0.75 * (i + 1)) / chunks });
  }
  return out;
}

function EmergencyButtons({ v }: { v: ChildView }) {
  const [sheet, setSheet] = useState<'call' | 'buddy' | null>(null);
  return (
    <>
      <Button variant="danger" block onClick={() => setSheet('call')}>
        <Siren size={20} /> Emergency Call
      </Button>
      <Button variant="dangerOutline" block onClick={() => setSheet('buddy')}>
        <Phone size={20} /> Contact Night Buddy
      </Button>
      {sheet === 'call' && (
        <Modal title="Call the police?" onClose={() => setSheet(null)}>
          <p className={ui.muted} style={{ marginBottom: 16 }}>
            This calls Singapore Police Force on 999. {v.person.short}'s last location: {v.session?.venue}.
          </p>
          <LinkButton variant="danger" block href="tel:999">
            <Siren size={20} /> Call 999
          </LinkButton>
          <Button variant="text" block style={{ marginTop: 8 }} onClick={() => setSheet(null)}>
            Cancel
          </Button>
        </Modal>
      )}
      {sheet === 'buddy' && (
        <Modal title="Contact Night Buddy" onClose={() => setSheet(null)}>
          {v.buddies.map((b) => (
            <div key={b.id} className={ui.row} style={{ padding: '8px 0' }}>
              <Avatar person={b} size={44} />
              <span style={{ flex: 1, fontWeight: 700 }}>{b.name}</span>
              <LinkButton variant="primary" href={telHref(b.phone)} aria-label={`Call ${b.name}`}>
                <Phone size={18} /> Call
              </LinkButton>
              <LinkButton variant="secondary" href={smsHref(b.phone)} aria-label={`Message ${b.name}`}>
                <MessageSquare size={18} />
              </LinkButton>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

export function WatcherMap() {
  const now = useNow(500);
  const w = useWorld((x) => x.world);
  const { extraChild, watcherSelected, set } = useUi();
  const [filter, setFilter] = useState<string>('all');
  const ids = linkedIds(extraChild);
  const views = ids.map((id) => childView(id, w, now));
  const ranked = rankChildren(views);
  const urgent = views.find((v) => v.emergency);
  const sel = views.find((v) => v.person.id === watcherSelected) ?? ranked[0];

  // Priority rule: a child in emergency is auto-selected.
  useEffect(() => {
    if (urgent && urgent.person.id !== watcherSelected) set({ watcherSelected: urgent.person.id });
  }, [urgent?.emergency]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = !!sel.session;
  const markers: MapMarker[] = [];
  if (active && sel.pos) {
    markers.push({
      id: 'child',
      pos: sel.pos,
      z: 1000,
      label: `${sel.person.name}, ${sel.status}`,
      html: sel.ride && sel.ride.stage === 'trip'
        ? pinHtml({ initials: '', tone: 'safe', car: true, name: sel.person.short, chip: 'In ride' })
        : pinHtml({ initials: sel.person.initials, tone: TONE[sel.status], name: sel.person.short, chip: sel.status === 'SAFE' ? 'Safe' : sel.status, pulse: true }),
    });
  }
  if (active && sel.session && !sel.ride) {
    markers.push({ id: 'dest', pos: sel.session.venuePos, html: destHtml(sel.session.venue, '· destination'), size: DEST_SIZE, anchor: DEST_ANCHOR, label: `Destination ${sel.session.venue}`, z: -200 });
  }
  const trail = fadingTrail(sel.trail as [number, number][]);
  const onTrip = sel.ride?.stage === 'trip' || sel.ride?.stage === 'arrived';
  const fit = onTrip && sel.ride ? ridePositions(sel.ride, now).route : [...sel.trail, ...(sel.session && !sel.ride ? [sel.session.venuePos] : [])];
  const viewKey = `${sel.person.id}-${active}-${w.beat}-${sel.session?.venue ?? ''}-${sel.ride?.stage ?? ''}`;
  const updates = filter === 'all' ? views.flatMap((v) => v.updates).sort((a, b) => b.ms - a.ms) : views.find((v) => v.person.id === filter)?.updates ?? [];

  return (
    <>
      <Header
        title="Map"
        subtitle={`Watching over ${views.map((v) => v.person.short).join(', ')}`}
        pill={<SessionPill active={active} label={active ? `Active: ${sel.person.short} is on a Night Out` : `Inactive: ${sel.person.short} isn't out`} />}
      />
      {urgent && (
        <button type="button" className={s.attention} onClick={() => set({ watcherSelected: urgent.person.id })} role="alert">
          <AlertTriangle size={20} aria-hidden /> {urgent.person.short} needs attention
        </button>
      )}
      {views.length > 1 && (
        <div className={s.switcher} role="tablist" aria-label="Who you're looking after">
          {ranked.map((v) => (
            <button
              key={v.person.id}
              type="button"
              role="tab"
              aria-selected={v.person.id === sel.person.id}
              className={cx(s.kid, v.person.id === sel.person.id && s.kidOn, v.emergency && s.kidAlert)}
              onClick={() => set({ watcherSelected: v.person.id })}
            >
              <Avatar person={v.person} size={38} />
              {v.person.short}
              <span className={s.kidDot} style={{ background: STATUS_COLOR[v.status] }} aria-hidden />
              <span className="sr-only">{v.status === 'OUT' ? 'Not out' : v.status}</span>
            </button>
          ))}
        </div>
      )}

      <div className={s.map}>
        <MapView
          target={active && fit.length ? { fit, maxZoom: 17 } : { center: SG_CENTER, zoom: 11 }}
          viewKey={viewKey}
          markers={markers}
          lines={active ? trail : []}
          zoomControls
        />
        {active && (
          <span className={s.trailChip}>
            <span className={s.trailDash} aria-hidden /> 60-minute trail
          </span>
        )}
      </div>

      <div className={s.scroll}>
        {active && sel.session ? (
          <section className={ui.card} aria-label="Current session">
            <h2 className={s.cardTitle}>Current Session</h2>
            <dl className={s.kv}>
              <dt>Duration</dt>
              <dd>
                {fmtTime(sel.session.startMin)} – {fmtTime(sel.session.returnMin)}
              </dd>
              <dt>Venue</dt>
              <dd>
                {sel.session.venues.map((vn, i) => (
                  <span key={`${vn}-${i}`}>
                    {i > 0 && ' → '}
                    {i === sel.session!.venues.length - 1 ? <strong>{vn}</strong> : <span style={{ fontWeight: 500 }}>{vn}</span>}
                  </span>
                ))}
                {sel.ride && (
                  <span className={s.reason}>
                    <Car size={14} aria-hidden style={{ verticalAlign: -2 }} /> Heading home · ETA {fmtTime(sel.ride.etaMin)}
                  </span>
                )}
              </dd>
              <dt>Now</dt>
              <dd>{fmtTime(nowMin(w, now))}</dd>
              <dt>Night Buddies</dt>
              <dd>{sel.buddies.map((b) => b.name).join(', ')}</dd>
              <dt>Drinking pace</dt>
              <dd>
                <strong style={{ color: sel.pace === 'HIGH' ? 'var(--danger)' : sel.pace === 'MED' ? 'var(--warn)' : 'var(--safe)' }}>{sel.pace}</strong>
              </dd>
              <dt>Well-Being</dt>
              <dd aria-live="assertive">
                <StatusPill status={sel.status} />
                <span className={s.reason}>{sel.reason}</span>
              </dd>
            </dl>
            {(sel.status === 'MISSING' || sel.status === 'SOS') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <EmergencyButtons v={sel} />
              </div>
            )}
          </section>
        ) : (
          <section className={cx(ui.card, s.inactive)}>
            <span className={ui.row}>
              <Avatar person={sel.person} size={44} />
              <StatusPill status="OUT" />
            </span>
            <p>
              {sel.person.short} isn't on a Night Out right now. You'll get an update when {sel.person.id === 'ethan' ? 'he' : 'she'} starts one.
            </p>
            {sel.lastSession && <p className={cx(ui.muted, ui.small)}>{sel.lastSession}</p>}
          </section>
        )}

        <section className={ui.card} aria-label="Updates">
          <h2 className={s.cardTitle}>Updates</h2>
          {views.length > 1 && (
            <div className={s.filter}>
              {['all', ...ids].map((f) => (
                <button key={f} type="button" className={cx(s.filterBtn, filter === f && s.filterOn)} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : views.find((v) => v.person.id === f)?.person.short}
                </button>
              ))}
            </div>
          )}
          <div className={s.updates}>
            {updates.length === 0 && <p className={cx(ui.muted, ui.small)}>Quiet so far. You'll only be alerted loudly in an emergency.</p>}
            {updates.slice(0, 30).map((e) => (
              <div key={e.id} className={s.update}>
                <span className={s.updateTime}>{fmtTime(e.simMin)}</span>
                <span className={cx(e.tone === 'danger' && s.updateDanger, e.tone === 'safe' && s.updateSafe)}>
                  {e.loud && e.tone === 'danger' && <AlertTriangle size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 4 }} />}
                  {e.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
