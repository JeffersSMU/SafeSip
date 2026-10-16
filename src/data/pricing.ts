// Ride fare model (DESIGN §5.8). Times are "sim minutes": minutes since Wednesday 00:00,
// so 9:00 PM Wed = 1260 and 1:55 AM Thu = 1555.

export interface Amenities {
  bags: boolean;
  cover: boolean;
  water: boolean;
}

export const AMENITY_INFO: { key: keyof Amenities; label: string; short: string; price: number }[] = [
  { key: 'bags', label: 'Sickness bags', short: 'bags', price: 1.0 },
  { key: 'cover', label: 'Seat cover', short: 'cover', price: 1.5 },
  { key: 'water', label: 'Bottled water', short: 'water', price: 0.5 },
];

export const BASE_FARE = 2.5;
export const PER_KM = 0.5;
export const PER_MIN = 0.16;
export const PLATFORM_FEE = 1.2;

export type Band = 'late' | 'peak' | 'normal';

/** Time band of a sim minute (day 0 = Wednesday). */
export function bandAt(simMin: number): Band {
  const day = Math.floor(simMin / 1440) % 7; // 0 Wed, 1 Thu, 2 Fri, 3 Sat, 4 Sun, 5 Mon, 6 Tue
  const m = ((simMin % 1440) + 1440) % 1440;
  if (m < 6 * 60) return 'late';
  const weekday = day <= 2 || day >= 5; // Mon-Fri
  if (weekday && m >= 6 * 60 && m < 9 * 60 + 30) return 'peak';
  if (m >= 18 * 60) return 'peak';
  return 'normal';
}

export const BAND_MULT: Record<Band, number> = { late: 1.5, peak: 1.25, normal: 1.0 };
export const BAND_SPEED: Record<Band, number> = { late: 45, peak: 30, normal: 38 };
export const BAND_LABEL: Record<Band, string> = {
  late: 'Late night ×1.5 (00:00–05:59)',
  peak: 'Peak ×1.25',
  normal: 'Standard ×1.0',
};

export interface FareQuote {
  km: number;
  minutes: number;
  band: Band;
  metered: number;
  banded: number;
  amenities: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Upfront fare for a trip of `km` booked at `simMin` with the ticked amenities. */
export function quoteFare(km: number, simMin: number, a: Amenities): FareQuote {
  const band = bandAt(simMin);
  const minutes = Math.round((km / BAND_SPEED[band]) * 60);
  const metered = round2(BASE_FARE + PER_KM * km + PER_MIN * minutes);
  const banded = round2(metered * BAND_MULT[band]);
  const amenities = round2(AMENITY_INFO.reduce((s, x) => s + (a[x.key] ? x.price : 0), 0));
  const total = round2(banded + PLATFORM_FEE + amenities);
  return { km, minutes, band, metered, banded, amenities, total };
}

/** Number of nearby drivers offering every ticked amenity (hardcoded pool). */
export function driversOffering(a: Amenities): number {
  const n = AMENITY_INFO.filter((x) => a[x.key]).length;
  return [21, 17, 14, 12][n];
}

export const money = (n: number) => `$${n.toFixed(2)}`;
