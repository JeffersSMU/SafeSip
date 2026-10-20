import { BatteryMedium, MessageSquare, Phone } from 'lucide-react';
import { Avatar, Button, LinkButton, Modal, StatusPill, ui } from '../../components/ui';
import { CHLOE, personById } from '../../data/cast';
import { useNow, useUi, useWorld } from '../../store';
import { agoLabel } from '../../store/time';
import { buddyBattery, buddyDistanceM, buddyView, chloeBattery, nowMin, userWellbeing } from '../../store/world';
import s from './user.module.css';

const telHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;
const smsHref = (phone: string) => `sms:${phone.replace(/\s/g, '')}`;
const ignoreAction = () => {};

/** Pin / buddy detail sheet: name, status, last update, venue, distance, battery, Call / Message. */
export function PersonSheet({ id, inactiveActions = false }: { id: string; inactiveActions?: boolean }) {
  const now = useNow(2000);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const close = () => set({ sheet: null });
  const isMe = id === CHLOE.id;
  const p = isMe ? CHLOE : personById(id);
  const b = w.buddies[id];
  const t = nowMin(w, now);
  const status = isMe ? userWellbeing(w, now) : buddyView(w, id, now).status;
  const venue = w.chloe.session?.venue ?? 'Home';
  const rows: [string, string][] = [
    ['Last update', isMe ? 'just now' : agoLabel(b?.updatedMin ?? t, t)],
    ['Venue', venue],
    ['Distance', isMe ? '—' : `${Math.round(buddyDistanceM(w, id, now))} m from you`],
    ['Battery', `${isMe ? chloeBattery(w, now) : buddyBattery(w, now)}%`],
  ];
  return (
    <Modal title={isMe ? 'You' : p.name} onClose={close}>
      <div className={ui.row} style={{ marginBottom: 14 }}>
        <Avatar person={p} size={56} />
        <div>
          <p style={{ fontWeight: 750 }}>{p.name}</p>
          <StatusPill status={w.chloe.session ? status : 'OUT'} label={isMe && !w.chloe.session ? 'No session' : undefined} />
        </div>
      </div>
      <dl style={{ margin: 0 }}>
        {rows.map(([k, v]) => (
          <div key={k} className={s.setRow} style={{ padding: '8px 0', minHeight: 44 }}>
            <dt className={s.setLabel}>
              {k === 'Battery' && <BatteryMedium size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />}
              {k}
            </dt>
            <dd className={s.setValue} style={{ margin: 0 }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {!isMe && (
        <div className={s.btnRow} style={{ marginTop: 16 }}>
          {inactiveActions ? (
            <>
              <Button variant="primary" block onClick={ignoreAction}><Phone size={18} /> Call</Button>
              <Button variant="secondary" block onClick={ignoreAction}><MessageSquare size={18} /> Message</Button>
            </>
          ) : (
            <>
              <LinkButton variant="primary" block href={telHref(p.phone)}><Phone size={18} /> Call</LinkButton>
              <LinkButton variant="secondary" block href={smsHref(p.phone)}><MessageSquare size={18} /> Message</LinkButton>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export { telHref, smsHref };
