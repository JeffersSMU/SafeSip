import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronsRight } from 'lucide-react';
import s from './ui.module.css';

const HOLD_MS = 1500;

/**
 * Red slide-to-confirm track (SOS + Need Help). Keyboard/assistive path: focus the handle and hold
 * Enter or Space for 1.5 s (DESIGN §5.6).
 */
export function SlideToConfirm({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [hold, setHold] = useState(0);
  const drag = useRef<{ start: number; max: number } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const done = useRef(false);

  const max = () => (track.current ? track.current.clientWidth - 64 : 200);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setX(max());
    navigator.vibrate?.(60);
    onConfirm();
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { start: e.clientX - x, max: max() };
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const nx = Math.max(0, Math.min(drag.current.max, e.clientX - drag.current.start));
    setX(nx);
    if (nx >= drag.current.max * 0.92) {
      drag.current = null;
      finish();
    }
  };
  const onUp = () => {
    if (!done.current) setX(0);
    drag.current = null;
  };

  const startHold = () => {
    if (holdTimer.current || disabled) return;
    const t0 = Date.now();
    holdTimer.current = window.setInterval(() => {
      const f = Math.min(1, (Date.now() - t0) / HOLD_MS);
      setHold(f);
      setX(f * max());
      if (f >= 1) {
        stopHold(false);
        finish();
      }
    }, 30);
  };
  const stopHold = (reset = true) => {
    window.clearInterval(holdTimer.current);
    holdTimer.current = undefined;
    if (reset && !done.current) {
      setHold(0);
      setX(0);
    }
  };
  useEffect(() => () => window.clearInterval(holdTimer.current), []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) startHold();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') stopHold();
  };

  return (
    <div ref={track} className={s.slide} aria-disabled={disabled}>
      <div className={s.slideFill} style={{ width: x + 60 }} />
      <span className={s.slideLabel} aria-hidden>
        {label}
      </span>
      <button
        type="button"
        className={s.slideHandle}
        style={{ transform: `translateX(${x}px)`, transition: drag.current || hold ? 'none' : 'transform 0.2s' }}
        aria-label={`${label}. Slide right, or hold Enter for 1.5 seconds`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => stopHold()}
        disabled={disabled}
      >
        <ChevronsRight size={28} />
      </button>
    </div>
  );
}
