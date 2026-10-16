import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, Wine, CircleSlash } from 'lucide-react';
import type { Person } from '../data/cast';
import { useUi, useWorld, useNow } from '../store';
import { fmtTime } from '../store/time';
import { nowMin } from '../store/world';
import s from './ui.module.css';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'safe' | 'danger' | 'dangerOutline' | 'ride' | 'text' | 'plain';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = 'plain', block, className, ...rest }: BtnProps) {
  return <button type="button" className={cx(s.btn, variant !== 'plain' && s[variant], block && s.block, className)} {...rest} />;
}

interface LinkBtnProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  block?: boolean;
}

/** Anchor styled as a button, for tel:/sms: links. */
export function LinkButton({ variant = 'plain', block, className, ...rest }: LinkBtnProps) {
  return <a className={cx(s.btn, variant !== 'plain' && s[variant], block && s.block, className)} {...rest} />;
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} className={cx(s.iconBtn, className)} {...rest}>
      {children}
    </button>
  );
}

export function Avatar({ person, size = 44, ring }: { person: Pick<Person, 'initials' | 'color' | 'name'>; size?: number; ring?: string }) {
  return (
    <span
      className={s.avatar}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: person.color,
        fontSize: size * 0.36,
        boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 5px ${ring}` : undefined,
      }}
    >
      {person.initials}
    </span>
  );
}

export type PillStatus = 'SAFE' | 'APART' | 'MISSING' | 'SOS' | 'OUT';

const STATUS_ICON: Record<PillStatus, ReactNode> = {
  SAFE: <CheckCircle2 size={14} aria-hidden />,
  APART: <AlertTriangle size={14} aria-hidden />,
  MISSING: <ShieldAlert size={14} aria-hidden />,
  SOS: <ShieldAlert size={14} aria-hidden />,
  OUT: <CircleSlash size={14} aria-hidden />,
};

/** Status is never colour-only: label + icon + colour (DESIGN §2.3). */
export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  return (
    <span className={cx(s.status, s[`s_${status}`])}>
      {STATUS_ICON[status]}
      {label ?? (status === 'OUT' ? 'Not out' : status)}
    </span>
  );
}

export const STATUS_COLOR: Record<PillStatus, string> = {
  SAFE: 'var(--safe)',
  APART: 'var(--warn)',
  MISSING: 'var(--danger)',
  SOS: 'var(--danger)',
  OUT: 'var(--text-muted)',
};

/**
 * Header status pill. Triple-tap opens the hidden Demo Director (DESIGN §7).
 */
export function SessionPill({ active, onLabel, offLabel }: { active: boolean; onLabel: string; offLabel: string }) {
  const taps = useRef<number[]>([]);
  const setUi = useUi((u) => u.set);
  const onClick = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 700), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      setUi({ modal: 'director' });
    }
  };
  return (
    <button type="button" className={cx(s.sessionPill, active && s.sessionPillOn)} onClick={onClick} aria-live="polite">
      <span className={active ? s.dot : s.dotHollow} aria-hidden />
      {active ? onLabel : offLabel}
    </button>
  );
}

export function SimClock() {
  useNow(1000);
  const w = useWorld((x) => x.world);
  return (
    <span className={s.clockChip} aria-label={`Scenario time ${fmtTime(nowMin(w))}`}>
      {fmtTime(nowMin(w))}
    </span>
  );
}

export function Header({ title, subtitle, pill, right }: { title: string; subtitle?: ReactNode; pill: ReactNode; right?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.headerRow}>
        <div>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={s.headerRow} style={{ alignItems: 'center' }}>
        {pill}
        <SimClock />
      </div>
    </header>
  );
}

export interface NavItem<K extends string> {
  key: K;
  label: string;
  icon: ReactNode;
}

export function BottomNav<K extends string>({ items, value, onChange }: { items: NavItem<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <nav className={s.nav} aria-label="Main">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={cx(s.navBtn, value === it.key && s.navBtnOn)}
          aria-current={value === it.key ? 'page' : undefined}
          onClick={() => onChange(it.key)}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Modal / bottom sheet. Modals close with X (DESIGN §2.3). Without `onClose` there is no X and the
 * scrim does not dismiss (used by the well-being check-in).
 */
export function Modal({
  title,
  onClose,
  center,
  children,
  className,
  zIndex,
}: {
  title: ReactNode;
  onClose?: () => void;
  center?: boolean;
  children: ReactNode;
  className?: string;
  zIndex?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useRef(`m-${Math.random().toString(36).slice(2)}`).current;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className={cx(s.scrim, center && s.scrimCenter)}
      style={zIndex ? { zIndex } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        ref={panel}
        className={cx(s.panel, center && s.panelCenter, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {!center && <div className={s.grabber} aria-hidden />}
        <div className={s.panelHead}>
          <h2 id={titleId} className={s.panelTitle}>
            {title}
          </h2>
          {onClose && (
            <IconButton label="Close" onClick={onClose}>
              <X size={22} />
            </IconButton>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((u) => u.toasts);
  return (
    <div className={s.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx(s.toast, s[`toast_${t.tone}`])}>
          {t.tone === 'safe' ? <CheckCircle2 size={20} /> : t.tone === 'info' ? <Info size={20} /> : <AlertTriangle size={20} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/** iOS-style notification banner for "system" events (DESIGN §5.9). */
export function Banner({ title, body, actions }: { title: string; body: string; actions: ReactNode }) {
  return (
    <div className={s.banner} role="alert">
      <div className={s.bannerTop}>
        <span className={s.appIcon} aria-hidden>
          <Wine size={13} />
        </span>
        SafeSip · now
      </div>
      <p className={s.bannerTitle}>{title}</p>
      <p className={s.bannerBody}>{body}</p>
      <div className={s.bannerActions}>{actions}</div>
    </div>
  );
}

export { s as ui };
