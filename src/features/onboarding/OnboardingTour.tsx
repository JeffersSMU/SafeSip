import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useUi, type Role, type UserTab, type WatcherTab } from '../../store';
import { onboardingStepsFor } from './steps';
import s from './onboarding.module.css';

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OnboardingTour({ role, suspended = false }: { role: Role; suspended?: boolean }) {
  const onboarding = useUi((u) => u.onboarding);
  const userTab = useUi((u) => u.userTab);
  const watcherTab = useUi((u) => u.watcherTab);
  const modal = useUi((u) => u.modal);
  const fullscreen = useUi((u) => u.fullscreen);
  const sheet = useUi((u) => u.sheet);
  const reducedMotion = useUi((u) => u.reduceMotion ?? u.systemReducedMotion);
  const steps = onboardingStepsFor(role);
  const active = onboarding?.role === role ? onboarding : null;
  const step = active ? steps[active.step] : undefined;
  const tooltipRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({ top: 16, left: 16 });
  const [desktopFrame, setDesktopFrame] = useState(false);
  const hasTour = !!(active && step);
  const blocked = suspended || modal !== null || fullscreen !== null || sheet !== null;
  const isOpen = hasTour && !blocked;
  const maskId = `onboarding-mask-${role}`;

  useEffect(() => {
    if (hasTour && blocked) useUi.getState().finishOnboarding();
  }, [blocked, hasTour]);

  useEffect(() => {
    if (!active) return;
    const currentTab = role === 'user' ? userTab : watcherTab;
    if (step?.tab === currentTab) return;
    const matchingIndex = steps.findIndex((candidate) => candidate.tab === currentTab);
    if (matchingIndex >= 0) useUi.getState().setOnboardingStep(matchingIndex);
  }, [active?.role, active?.step, role, step?.tab, steps, userTab, watcherTab]);

  useLayoutEffect(() => {
    if (!isOpen || !step) {
      setTargetRect(null);
      return;
    }
    if (!restoreFocusRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    const tabIsReady = role === 'user' ? userTab === step.tab : watcherTab === step.tab;
    if (!tabIsReady) return;

    const screenRect = document.querySelector<HTMLElement>('[data-phone-screen]')?.getBoundingClientRect();
    setDesktopFrame(!!screenRect);
    setTargetRect(null);
    let target: HTMLElement | null = null;
    let observer: MutationObserver | undefined;
    let timeout: number | undefined;
    const findTarget = () => {
      if (target) return;
      target = document.querySelector<HTMLElement>(`[data-onboarding="${step.target}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      observer?.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
      frame = window.requestAnimationFrame(measure);
    };
    const measure = () => {
      if (!target?.isConnected) {
        setTargetRect(null);
        return;
      }
      const screen = document.querySelector<HTMLElement>('[data-phone-screen]')?.getBoundingClientRect();
      setDesktopFrame(!!screen);
      const rect = target.getBoundingClientRect();
      setTargetRect({
        x: rect.left - (screen?.left ?? 0),
        y: rect.top - (screen?.top ?? 0) - (screen ? 44 : 0),
        width: rect.width,
        height: rect.height,
      });
    };
    let frame = window.requestAnimationFrame(() => {
      findTarget();
      measure();
    });
    observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    timeout = window.setTimeout(() => observer?.disconnect(), 1500);
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, role, step?.id, step?.tab, step?.target, userTab, watcherTab]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updateTooltipPosition = () => {
      const node = tooltipRef.current;
      if (!node) return;
      const screen = document.querySelector<HTMLElement>('[data-phone-screen]')?.getBoundingClientRect();
      const width = screen?.width ?? window.innerWidth;
      const height = (screen?.height ?? window.innerHeight) - (screen ? 44 : 0);
      const tip = node.getBoundingClientRect();
      const rootStyles = window.getComputedStyle(document.documentElement);
      const safeTop = Number.parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
      const safeBottom = Number.parseFloat(rootStyles.getPropertyValue('--safe-bottom')) || 0;
      const topEdge = 16 + (screen ? 0 : safeTop);
      const bottomEdge = 16 + (screen ? 0 : safeBottom);
      const gap = 14;
      let top = Math.max(topEdge, (height - tip.height) / 2);
      if (targetRect) {
        const roomBelow = height - targetRect.y - targetRect.height - gap - bottomEdge;
        const roomAbove = targetRect.y - gap - topEdge;
        if (roomBelow >= tip.height) top = targetRect.y + targetRect.height + gap;
        else if (roomAbove >= tip.height) top = targetRect.y - tip.height - gap;
        else if (roomBelow >= roomAbove) top = Math.max(topEdge, height - tip.height - bottomEdge);
        else top = topEdge;
      }
      const edge = 16;
      const tipWidth = Math.min(360, width - edge * 2);
      const targetCenter = targetRect ? targetRect.x + targetRect.width / 2 : width / 2;
      const left = Math.min(width - tipWidth - edge, Math.max(edge, targetCenter - tipWidth / 2));
      setTooltipStyle({ top, left, width: tipWidth });
    };
    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    return () => window.removeEventListener('resize', updateTooltipPosition);
  }, [isOpen, targetRect, active?.step]);

  useEffect(() => {
    if (!isOpen) {
      const previous = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (!blocked) {
        if (previous?.isConnected) previous.focus();
        else document.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
      }
      return;
    }
    tooltipRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        useUi.getState().finishOnboarding();
        return;
      }
      if (event.key !== 'Tab' || !tooltipRef.current) return;
      const focusable = [...tooltipRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === tooltipRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (blocked) return;
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) tooltipRef.current.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [blocked, isOpen]);

  if (!isOpen || !step || !active) return null;

  const goTo = (index: number) => {
    const next = steps[index];
    if (!next) return;
    const set = useUi.getState().set;
    if (role === 'user') set({ userTab: next.tab as UserTab });
    else set({ watcherTab: next.tab as WatcherTab });
    useUi.getState().setOnboardingStep(index);
  };

  const close = () => useUi.getState().finishOnboarding();

  return (
    <div className={s.overlay} data-reduced-motion={reducedMotion} style={desktopFrame ? { top: 44, bottom: 0, height: 'auto' } : undefined}>
      <svg className={s.scrim} aria-hidden="true" focusable="false">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && <rect x={targetRect.x - 6} y={targetRect.y - 6} width={targetRect.width + 12} height={targetRect.height + 12} rx="18" fill="black" />}
          </mask>
        </defs>
        <rect className={s.scrimFill} width="100%" height="100%" mask={`url(#${maskId})`} />
        {targetRect && <rect className={s.spotlightEdge} x={targetRect.x - 6} y={targetRect.y - 6} width={targetRect.width + 12} height={targetRect.height + 12} rx="18" />}
      </svg>
      <section
        ref={tooltipRef}
        className={s.tooltip}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${maskId}-title`}
        aria-describedby={`${maskId}-body`}
        tabIndex={-1}
      >
        <div className={s.tooltipHeader}>
          <span className={s.eyebrow}>SAFE SIP GUIDE</span>
          <button type="button" className={s.close} onClick={close} aria-label="Close onboarding guide">
            <X size={20} />
          </button>
        </div>
        <p className={s.progress} aria-live="polite">Step {active.step + 1} of {steps.length}</p>
        <h2 className={s.title} id={`${maskId}-title`}>{step.title}</h2>
        <p className={s.body} id={`${maskId}-body`}>{step.body}</p>
        <div className={s.actions}>
          <button type="button" className={s.skip} onClick={close}>Skip</button>
          <div className={s.nextActions}>
            <button type="button" className={s.back} onClick={() => goTo(active.step - 1)} disabled={active.step === 0} aria-label="Previous step">
              <ArrowLeft size={18} />
            </button>
            {active.step === steps.length - 1 ? (
              <button type="button" className={s.next} onClick={close}>Done</button>
            ) : (
              <button type="button" className={s.next} onClick={() => goTo(active.step + 1)}>
                Next <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
