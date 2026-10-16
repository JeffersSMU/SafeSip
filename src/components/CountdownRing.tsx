import s from './ui.module.css';

/** Circular countdown; `remaining` and `total` in seconds. */
export function CountdownRing({ remaining, total, size = 120, color = 'var(--warn)' }: { remaining: number; total: number; size?: number; color?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, remaining / total));
  return (
    <div className={s.ring} style={{ width: size, height: size }} role="timer" aria-label={`${Math.ceil(remaining)} seconds left`}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <span className={s.ringLabel}>{Math.max(0, Math.ceil(remaining))}</span>
    </div>
  );
}
