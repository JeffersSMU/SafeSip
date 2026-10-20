import routeJson from './route-chupitos-yishun.json';

export type LatLng = [number, number];

// DESIGN §8 hardcoded coordinates.
export const HOME: LatLng = [1.4295, 103.835];
export const ZOUK: LatLng = [1.2906, 103.8462];
export const CHUPITOS: LatLng = [1.2907, 103.8468];
export const CLARKE_QUAY_MRT: LatLng = [1.2886, 103.8465];
/** Where Sarah waits in the restroom queue at B6 (~40 m from Chupitos). */
export const RESTROOM: LatLng = [1.29106, 103.84693];
/** Sarah's home (Toa Payoh), where she starts at B1 before heading to Zouk. */
export const SARAH_HOME: LatLng = [1.3343, 103.8563];

/** Pre-computed OSRM driving polyline Chupitos -> Yishun (one-off export, [lat, lng]). */
export const ROUTE_HOME: LatLng[] = routeJson as LatLng[];
/** Route length used for pricing and ETA (DESIGN §5.8 scenario value). */
export const ROUTE_HOME_KM = 22.4;

export interface Venue {
  name: string;
  area: string;
  pos: LatLng;
}

/** Hardcoded autocomplete list for the venue field (DESIGN §5.2). */
export const VENUES: Venue[] = [
  { name: 'Zouk', area: '3C River Valley Rd, Clarke Quay', pos: ZOUK },
  { name: 'Chupitos', area: 'Clarke Quay', pos: CHUPITOS },
  { name: 'Clarke Quay', area: 'River Valley Rd', pos: [1.2905, 103.8465] },
  { name: 'Lavo', area: 'Marina Bay Sands', pos: [1.2834, 103.8607] },
  { name: 'Marquee', area: 'Marina Bay Sands', pos: [1.2838, 103.8591] },
  { name: 'Headquarters by The Council', area: 'Boat Quay', pos: [1.2862, 103.8496] },
];

export const venuePos = (name: string): LatLng =>
  VENUES.find((v) => v.name.toLowerCase() === name.toLowerCase())?.pos ?? CHUPITOS;

/** Nearest listed venue to a point (used for "Select from map" and venue-change detection). */
export function nearestVenue(p: LatLng): { venue: Venue; m: number } {
  let best = VENUES[0];
  let bestM = Infinity;
  for (const v of VENUES) {
    const m = distanceM(p, v.pos);
    if (m < bestM) {
      best = v;
      bestM = m;
    }
  }
  return { venue: best, m: bestM };
}

export interface RidePoint {
  id: string;
  name: string;
  area: string;
  pos: LatLng;
  /** Extra km versus the scenario route (Chupitos -> Home), hardcoded. */
  dKm: number;
}

/** Hardcoded pickup choices on the "Get Home Safely" screen. */
export const PICKUPS: RidePoint[] = [
  { id: 'chupitos', name: 'Chupitos', area: 'Clarke Quay · your location', pos: CHUPITOS, dKm: 0 },
  { id: 'zouk', name: 'Zouk', area: '3C River Valley Rd', pos: ZOUK, dKm: 0.1 },
  { id: 'cq-mrt', name: 'Clarke Quay MRT', area: 'Exit E', pos: CLARKE_QUAY_MRT, dKm: 0.3 },
];

/** Hardcoded drop-off choices. */
export const DROPOFFS: RidePoint[] = [
  { id: 'home', name: 'Home', area: 'Yishun', pos: HOME, dKm: 0 },
  { id: 'yishun-mrt', name: 'Yishun MRT', area: 'Yishun Ave 2', pos: [1.4294, 103.8351], dKm: -0.6 },
  { id: 'sarah', name: "Sarah's place", area: 'Toa Payoh', pos: SARAH_HOME, dKm: -13.1 },
];

/** Distance in metres between two points (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point at fraction t (0..1) along a polyline, by length. */
export function pointAlong(line: LatLng[], t: number): LatLng {
  if (line.length === 0) return HOME;
  if (t <= 0) return line[0];
  if (t >= 1) return line[line.length - 1];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = distanceM(line[i - 1], line[i]);
    seg.push(d);
    total += d;
  }
  let target = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const f = seg[i] === 0 ? 0 : target / seg[i];
      const a = line[i];
      const b = line[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    target -= seg[i];
  }
  return line[line.length - 1];
}

/** Polyline prefix up to fraction t, ending exactly at pointAlong(t). */
export function sliceAlong(line: LatLng[], t: number): LatLng[] {
  if (t <= 0) return [line[0]];
  const end = pointAlong(line, t);
  const out: LatLng[] = [line[0]];
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < line.length; i++) {
    const d = distanceM(line[i - 1], line[i]);
    lens.push(d);
    total += d;
  }
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    acc += lens[i - 1];
    if (acc / total >= t) break;
    out.push(line[i]);
  }
  out.push(end);
  return out;
}

/** Short approach path for the driver heading to the Chupitos pickup (arriving stage). */
export const DRIVER_APPROACH: LatLng[] = [
  [1.2943, 103.8441],
  [1.2931, 103.8452],
  [1.292, 103.846],
  [1.2912, 103.8465],
  CHUPITOS,
];
