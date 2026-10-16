// Simulated clock. A "sim minute" counts minutes since Wednesday 00:00 (16 Oct 2026).
// The clock is a base + real-time anchor + rate, so every device derives the same time
// from the synced record without streaming ticks.

export interface Clock {
  base: number; // sim minutes at `at`
  at: number; // real epoch ms
  rate: number; // sim minutes per real minute
}

export const T = (h: number, m = 0, nextDay = false) => (nextDay ? 1440 : 0) + h * 60 + m;
export const START_MIN = T(21, 0); // 9:00 PM Wed

export const simNow = (c: Clock, nowMs = Date.now()) => c.base + ((nowMs - c.at) / 60000) * c.rate;
export const clockAt = (simMin: number, rate = 1, nowMs = Date.now()): Clock => ({ base: simMin, at: nowMs, rate });

/** "9:00 PM" style label. */
export function fmtTime(simMin: number): string {
  const m = ((Math.floor(simMin) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "9:00" without the suffix, for the status bar. */
export const fmtClock = (simMin: number) => fmtTime(simMin).replace(/ (AM|PM)$/, '');

export function fmtDay(simMin: number): string {
  const days = ['Wed, 16 Oct', 'Thu, 17 Oct', 'Fri, 18 Oct'];
  return days[Math.min(days.length - 1, Math.max(0, Math.floor(simMin / 1440)))];
}

export function fmtDuration(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

export function agoLabel(simMin: number, nowMin: number): string {
  const d = Math.max(0, Math.round(nowMin - simMin));
  if (d < 1) return 'just now';
  if (d < 60) return `${d} min ago`;
  return `${Math.floor(d / 60)} h ago`;
}
