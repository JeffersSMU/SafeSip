import { useEffect, useRef } from 'react';
import { cx } from './ui';
import s from './ui.module.css';

const ITEM_H = 40;

function Column({ items, index, onIndex, label }: { items: string[]; index: number; onIndex: (i: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_H) !== index) el.scrollTop = index * ITEM_H;
  }, [index]);
  return (
    <div
      ref={ref}
      className={s.wheelCol}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          const i = Math.max(0, Math.min(items.length - 1, Math.round((ref.current?.scrollTop ?? 0) / ITEM_H)));
          if (i !== index) onIndex(i);
        }, 90);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onIndex(Math.min(items.length - 1, index + 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onIndex(Math.max(0, index - 1));
        }
      }}
    >
      {items.map((it, i) => (
        <button
          key={it}
          type="button"
          tabIndex={-1}
          role="option"
          aria-selected={i === index}
          className={cx(s.wheelItem, i === index && s.wheelItemOn)}
          onClick={() => onIndex(i)}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const AMPM = ['AM', 'PM'];

/**
 * Wheel time picker (heuristic G3). Value is minutes past midnight of the *night* in 5-minute steps;
 * AM times are treated as after midnight (next day), matching a night out.
 */
export function TimeWheel({ value, onChange }: { value: number; onChange: (simMin: number) => void }) {
  const m = ((value % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const hIdx = (h24 % 12 === 0 ? 12 : h24 % 12) - 1;
  const mIdx = Math.round((m % 60) / 5) % 12;
  const pIdx = h24 < 12 ? 0 : 1;
  const emit = (hi: number, mi: number, pi: number) => {
    const h12 = hi + 1;
    const h = (h12 % 12) + (pi === 1 ? 12 : 0);
    const mins = h * 60 + mi * 5;
    onChange(pi === 0 ? 1440 + mins : mins);
  };
  return (
    <div className={s.wheel}>
      <Column label="Hour" items={HOURS} index={hIdx} onIndex={(i) => emit(i, mIdx, pIdx)} />
      <Column label="Minute" items={MINS} index={mIdx} onIndex={(i) => emit(hIdx, i, pIdx)} />
      <Column label="AM or PM" items={AMPM} index={pIdx} onIndex={(i) => emit(hIdx, mIdx, i)} />
    </div>
  );
}
