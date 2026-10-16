import { CheckCircle2, HeartHandshake } from 'lucide-react';
import { Button, Modal, cx } from '../../components/ui';
import { CountdownRing } from '../../components/CountdownRing';
import { SlideToConfirm } from '../../components/SlideToConfirm';
import { personById } from '../../data/cast';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { CHECKIN_BUDDY_S, CHECKIN_NOK_S, CHECKIN_WARN_S, answerCheckInOk, checkInElapsedS, startSos } from '../../store/world';
import s from './user.module.css';

/**
 * Automated well-being check-in (DESIGN §5.7). No X and no scrim dismiss (heuristic E3).
 * 60 s window, then buddies are alerted; a second 60 s window, then Next-of-Kin.
 */
export function CheckInModal() {
  const now = useNow(250);
  const w = useWorld((x) => x.world);
  const c = w.chloe.checkIn!;
  const el = checkInElapsedS(c, now);
  const names = (w.chloe.session?.buddies ?? []).map((b) => personById(b).short);
  const buddyLabel = names.join(' & ') || 'your Night Buddies';

  let remaining: number;
  let msg: string;
  let danger = false;
  if (el < CHECKIN_BUDDY_S) {
    remaining = CHECKIN_BUDDY_S - el;
    msg = el >= CHECKIN_WARN_S ? `${buddyLabel} and Helen will be notified in ${Math.ceil(remaining)} s` : '';
  } else if (el < CHECKIN_NOK_S) {
    remaining = CHECKIN_NOK_S - el;
    msg = `${buddyLabel} has been alerted. Helen will be notified in ${Math.ceil(remaining)} s`;
    danger = true;
  } else {
    remaining = 0;
    msg = `${buddyLabel} and Helen have been alerted`;
    danger = true;
  }

  return (
    <Modal title="Well-Being Check-in" center zIndex={70}>
      <div className={s.ci}>
        <HeartHandshake size={36} color="var(--brand)" aria-hidden />
        <p>You've been away from {buddyLabel} for 30 minutes. How are you doing?</p>
        <CountdownRing remaining={remaining} total={60} color={danger ? 'var(--danger)' : 'var(--warn)'} />
        <p className={cx(s.ciMsg, danger && s.ciMsgDanger)} aria-live="assertive">
          {msg}
        </p>
        <Button variant="safe" block onClick={() => dispatch((wd, n) => answerCheckInOk(wd, n, useUi.getState().checkInInterval))}>
          <CheckCircle2 size={22} /> I'm Okay
        </Button>
        <div style={{ width: '100%' }}>
          <SlideToConfirm label="Need Help (Slide right)" onConfirm={() => dispatch((wd, n) => startSos(wd, 'checkin', n))} />
        </div>
      </div>
    </Modal>
  );
}
