import { Check, Loader2, MapPin, Phone, ShieldAlert, Siren, X } from 'lucide-react';
import { Avatar, Button, IconButton, LinkButton, Modal, cx, ui } from '../../components/ui';
import { SlideToConfirm } from '../../components/SlideToConfirm';
import { NEXT_OF_KIN, personById } from '../../data/cast';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { cancelSos, sosRecipients, startSos } from '../../store/world';
import { telHref } from './PersonSheet';
import s from './user.module.css';

const roleLabel = (id: string) => {
  const nok = NEXT_OF_KIN.find((n) => n.personId === id);
  return nok ? `Next-of-Kin · ${nok.relationship}` : 'Night Buddy';
};

/** SOS sheet: recipients + slide to send (DESIGN §5.6). */
export function SosSheet() {
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const close = () => set({ modal: null });
  const rec = sosRecipients(w);
  return (
    <Modal title="Emergency SOS" onClose={close} zIndex={92}>
      <p className={ui.muted} style={{ marginBottom: 14 }}>
        This sends an urgent alert with your live location to your Night Buddies and Next-of-Kin.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {rec.map((id) => {
          const p = personById(id);
          return (
            <div key={id} className={s.recipient}>
              <Avatar person={p} size={40} />
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>{p.name}</span>
                <span className={cx(ui.muted, ui.small)}>{roleLabel(id)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <SlideToConfirm
        label="Slide to send SOS"
        onConfirm={() => {
          dispatch((wd, n) => startSos(wd, 'button', n));
          set({ modal: null, sosHiddenId: null });
        }}
      />
      <Button variant="text" block style={{ marginTop: 10 }} onClick={close}>
        Never mind, I'm okay
      </Button>
    </Modal>
  );
}

const STEP_MS = 800;

/**
 * After the slide: step 1 non-silent alert with per-recipient progress, then step 2
 * "Who do you want to call?". Closing with X keeps the alert active.
 */
export function SosFlow() {
  const now = useNow(200);
  const w = useWorld((x) => x.world);
  const set = useUi((u) => u.set);
  const sos = w.chloe.sos!;
  const rec = sosRecipients(w);
  const el = now - sos.startedMs;
  const step2 = el >= STEP_MS * (rec.length + 1);
  const venue = w.chloe.session?.venue ?? 'your location';

  return (
    <div className={s.sosFull} role="alertdialog" aria-modal="true" aria-labelledby="sos-title">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton label="Close (alert stays active)" onClick={() => set({ sosHiddenId: sos.id })}>
          <X size={22} />
        </IconButton>
      </div>
      <span className={s.sosBadge} aria-hidden>
        <Siren size={40} />
      </span>
      {!step2 ? (
        <>
          <h2 id="sos-title" style={{ fontSize: 24, fontWeight: 850, textAlign: 'center' }}>
            Sending SOS alert…
          </h2>
          <p className={ui.muted} style={{ textAlign: 'center' }}>
            Loud alert with your live location at {venue}. It sounds even if their phone is on silent.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
            {rec.map((id, i) => {
              const p = personById(id);
              const done = el >= STEP_MS * (i + 1);
              return (
                <div key={id} className={s.recipient}>
                  <Avatar person={p} size={40} />
                  <span style={{ fontWeight: 700 }}>{done ? `${p.short} alerted` : `Alerting ${p.short}…`}</span>
                  <span className={s.recipientState} style={{ color: done ? 'var(--safe)' : 'var(--text-muted)' }}>
                    {done ? <Check size={20} aria-label="done" /> : <Loader2 size={20} aria-hidden />}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <h2 id="sos-title" style={{ fontSize: 24, fontWeight: 850, textAlign: 'center' }}>
            Who do you want to call?
          </h2>
          <LinkButton variant="danger" block className={s.callBtn} href="tel:999">
            <Siren size={24} />
            <span>
              Call Police · 999
              <small>Singapore Police Force</small>
            </span>
          </LinkButton>
          {NEXT_OF_KIN.map((n) => {
            const p = personById(n.personId);
            return (
              <LinkButton key={p.id} variant="secondary" block className={s.callBtn} href={telHref(p.phone)}>
                <Phone size={22} />
                <span>
                  Call {p.name} · {n.relationship}
                  <small>{p.phone}</small>
                </span>
              </LinkButton>
            );
          })}
          {(w.chloe.session?.buddies ?? []).map((id) => {
            const p = personById(id);
            return (
              <LinkButton key={id} variant="secondary" block className={s.callBtn} href={telHref(p.phone)}>
                <Phone size={22} />
                <span>
                  Call {p.name} · Night Buddy
                  <small>{p.phone}</small>
                </span>
              </LinkButton>
            );
          })}
          <p className={s.liveRow}>
            <ShieldAlert size={18} aria-hidden /> Alerts sent · <MapPin size={16} aria-hidden /> Sharing live location
          </p>
          <Button
            variant="safe"
            block
            onClick={() => {
              dispatch(cancelSos);
              set({ sosHiddenId: null });
            }}
          >
            I'm safe now
          </Button>
        </>
      )}
    </div>
  );
}
