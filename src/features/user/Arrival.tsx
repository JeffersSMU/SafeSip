import { Home, PartyPopper } from 'lucide-react';
import { Button, Modal, ui } from '../../components/ui';
import { dispatch, useUi, useWorld } from '../../store';
import { fmtDuration, fmtTime } from '../../store/time';
import { confirmArrival, finishSummary } from '../../store/world';
import s from './user.module.css';

/** "Have you arrived home?" (heuristic B2). */
export function ArrivalModal() {
  const set = useUi((u) => u.set);
  return (
    <Modal title="Have you arrived home?" center zIndex={72}>
      <div className={s.ci}>
        <Home size={40} color="var(--safe)" aria-hidden />
        <p className={ui.muted}>Your ride reached Yishun. Confirm you're home and we'll end your session and let Helen know.</p>
        <Button
          variant="safe"
          block
          onClick={() => {
            dispatch((w, n) => confirmArrival(w, true, n));
            set({ fullscreen: null });
          }}
        >
          Yes, I'm home
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            dispatch((w, n) => confirmArrival(w, false, n));
            set({ fullscreen: null });
          }}
        >
          Not yet, still out
        </Button>
      </div>
    </Modal>
  );
}

export function SummaryModal() {
  const sum = useWorld((w) => w.world.chloe.summary)!;
  const set = useUi((u) => u.set);
  const cells: [string, string][] = [
    ['Duration', `${fmtTime(sum.startMin)} – ${fmtTime(sum.endMin)}`],
    ['Time out', fmtDuration(sum.endMin - sum.startMin)],
    ['Venues', sum.venues.join(' → ') || '—'],
    ['Drinks', String(sum.drinks)],
    ['Check-ins', `${sum.checkInsAnswered}/${sum.checkInsTotal} answered`],
    ['Helen', 'Notified you’re home'],
  ];
  return (
    <Modal title="Home safe 🎉" center zIndex={72}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <PartyPopper size={22} color="var(--brand)" aria-hidden />
        <p className={ui.muted}>Here's your Night Out summary.</p>
      </div>
      <div className={s.sumGrid}>
        {cells.map(([k, v]) => (
          <div key={k} className={s.sumCell}>
            <span className={ui.muted} style={{ fontSize: 13 }}>
              {k}
            </span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        block
        onClick={() => {
          dispatch(finishSummary);
          set({ userTab: 'map' });
        }}
      >
        Done
      </Button>
    </Modal>
  );
}
