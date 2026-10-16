import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info, Minus, Plus, X } from 'lucide-react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import type { LatLng } from '../data/places';
import { motionReduced } from '../store';
import s from './map.module.css';

export interface MapMarker {
  id: string;
  pos: LatLng;
  html: string;
  size?: [number, number];
  anchor?: [number, number];
  label: string;
  onClick?: () => void;
  z?: number;
  /** How long a position change takes to glide there (ms, default 700; 0 snaps). */
  glideMs?: number;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  color?: string;
  weight?: number;
  dashed?: boolean;
  opacity?: number;
}

/** Pixels of map hidden under overlays, so fitting keeps pins in the visible area. */
export interface MapInsets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export type AttrPos = 'top-right' | 'top-left' | 'bottom-right';

export type MapViewTarget = { center: LatLng; zoom: number } | { fit: LatLng[]; maxZoom?: number };

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Basemap (DESIGN §9 / A11): CARTO Positron, which now needs a free key passed as ?key= on the tile URL.
// VITE_MAP_TILE_URL (a full {z}/{x}/{y} template) overrides it; without either, OSM standard tiles are
// used, greyed via CSS, so the map never shows CARTO's "API KEY REQUIRED" watermark.
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
const CUSTOM_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();

// CARTO's free key serves tiles up to z18 (z19+ returns 403), so deeper zooms upscale z18 tiles.
const TILES: { url: string; carto: boolean; subdomains: string; className?: string; maxZoom: number } = CUSTOM_URL
  ? { url: CUSTOM_URL, carto: false, subdomains: 'abc', maxZoom: 19 }
  : CARTO_KEY
    ? {
        url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`,
        carto: true,
        subdomains: 'abcd',
        maxZoom: 18,
      }
    : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', carto: false, subdomains: 'abc', className: 'ss-tiles', maxZoom: 19 };

export type PinTone = 'safe' | 'apart' | 'missing' | 'sos' | 'brand';

const BADGE: Record<PinTone, string> = { safe: '✓', apart: '!', missing: '!', sos: '!', brand: '' };

/**
 * Teardrop map pin with initials, a status badge and a name + status label underneath
 * (status is never colour-only: DESIGN §2.3). Anchor sits at the pin's tip.
 */
export function pinHtml(o: { initials: string; tone: PinTone; name?: string; chip?: string; pulse?: boolean; car?: boolean; labelTop?: boolean; self?: boolean }) {
  const cls = ['ss-mk', `ss-mk--${o.tone}`, o.pulse ? 'ss-mk--pulse' : '', o.car ? 'ss-mk--car' : '', o.labelTop ? 'ss-mk--top' : '', o.self ? 'ss-mk--self' : ''].join(' ');
  const badge = BADGE[o.tone] && !o.car ? `<span class="ss-mk__badge">${BADGE[o.tone]}</span>` : '';
  const label = o.name
    ? `<span class="ss-mk__label"><b>${esc(o.name)}</b>${o.chip ? `<span class="ss-mk__chip">${esc(o.chip)}</span>` : ''}</span>`
    : '';
  return `<div class="${cls}"><span class="ss-mk__pin"><span class="ss-mk__txt">${o.car ? '🚗' : esc(o.initials)}</span></span>${badge}${label}</div>`;
}
/** Icon box for pinHtml: wide enough for the label; anchor = pin tip. Use PIN_ANCHOR_TOP with labelTop. */
export const PIN_SIZE: [number, number] = [150, 80];
export const PIN_ANCHOR: [number, number] = [75, 50];
export const PIN_ANCHOR_TOP: [number, number] = [75, 72];

export const venueHtml = (name: string) => `<span class="ss-venue">${esc(name)}</span>`;

/** Target / meet-up point: a flag marker with a caption. Size [150, 64], anchor [75, 52] (flag foot). */
export const destHtml = (name: string, caption: string) =>
  `<div class="ss-dest"><span class="ss-dest__cap"><b>${esc(name)}</b> ${esc(caption)}</span><span class="ss-dest__flag">🏁</span><span class="ss-dest__dot"></span></div>`;
export const DEST_SIZE: [number, number] = [150, 64];
export const DEST_ANCHOR: [number, number] = [75, 58];
export const homeHtml = () => `<div class="ss-home" aria-hidden="true">⌂</div>`;

function ViewController({ target, viewKey, insets }: { target: MapViewTarget; viewKey: string; insets: MapInsets }) {
  const map = useMap();
  useEffect(() => {
    const reduce = motionReduced();
    const tl = L.point(40 + (insets.left ?? 0), 40 + (insets.top ?? 0));
    const br = L.point(40 + (insets.right ?? 0), 40 + (insets.bottom ?? 0));
    if ('fit' in target) {
      if (target.fit.length === 0) return;
      const b = L.latLngBounds(target.fit.map((p) => L.latLng(p[0], p[1])));
      map.flyToBounds(b, { paddingTopLeft: tl, paddingBottomRight: br, maxZoom: target.maxZoom ?? 17, animate: !reduce, duration: 1.2 });
    } else {
      // Centre the point in the visible area between the overlays.
      const dy = ((insets.bottom ?? 0) - (insets.top ?? 0)) / 2;
      const dx = ((insets.right ?? 0) - (insets.left ?? 0)) / 2;
      const c = map.unproject(map.project(target.center, target.zoom).add([dx, dy]), target.zoom);
      map.flyTo(c, target.zoom, { animate: !reduce, duration: 1.2 });
    }
    // Re-run only when the caller says the view should change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, map]);
  useEffect(() => {
    // Container size changes (phone frame, sheets) need Leaflet to re-measure.
    const id = window.setTimeout(() => map.invalidateSize(), 200);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

/**
 * Compact attribution: a small (i) in a map corner that expands to the OSM/CARTO credits.
 * Starts collapsed (change request 6). OSMF's attribution guideline prefers showing the credit at
 * first and collapsing it later; collapsed-by-default was chosen for clean recordings.
 */
function Attribution({ position }: { position: AttrPos }) {
  const [open, setOpen] = useState(false);
  useMapEvents({ dragstart: () => setOpen(false), zoomstart: () => setOpen(false) });
  return (
    <div className={`${s.attr} ${position.startsWith('top') ? s.attrTop : s.attrBottom} ${position.endsWith('left') ? s.attrLeft : ''}`}>
      {open && (
        <span className={s.attrText}>
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
          {TILES.carto && (
            <>
              {' '}
              © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>
            </>
          )}
        </span>
      )}
      <button type="button" className={s.attrBtn} aria-label={open ? 'Hide map credits' : 'Map data credits'} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <X size={13} /> : <Info size={14} />}
      </button>
    </div>
  );
}

function ClickCatcher({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e: LeafletMouseEvent) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** ~3 km in degrees: anything further is a jump (reset, deep link), not walking, so it snaps. */
const GLIDE_MAX_DEG = 0.03;

/**
 * Eases a marker from where it is shown to its new position, so people walk between beats instead of
 * teleporting. Tweens lat/lng (not CSS transforms), so it stays correct while the map zooms or flies.
 * Snaps instantly when motion is reduced.
 */
function useGlide(pos: LatLng, ms: number): LatLng {
  const [shown, setShown] = useState<LatLng>(pos);
  const shownRef = useRef<LatLng>(pos);
  const [lat, lng] = pos;
  useEffect(() => {
    const from = shownRef.current;
    if (from[0] === lat && from[1] === lng) return;
    const far = Math.abs(from[0] - lat) + Math.abs(from[1] - lng) > GLIDE_MAX_DEG;
    if (ms <= 0 || far || motionReduced()) {
      shownRef.current = [lat, lng];
      setShown([lat, lng]);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - (1 - k) ** 3; // ease-out cubic
      const p: LatLng = [from[0] + (lat - from[0]) * e, from[1] + (lng - from[1]) * e];
      shownRef.current = p;
      setShown(p);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lat, lng, ms]);
  return shown;
}

/** Small stacked zoom in/out control, docked top-right below the attribution (i) button. */
function ZoomControls() {
  const map = useMap();
  return (
    <div className={s.zoom}>
      <button type="button" className={s.zoomBtn} aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <Plus size={18} aria-hidden />
      </button>
      <button type="button" className={s.zoomBtn} aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <Minus size={18} aria-hidden />
      </button>
    </div>
  );
}

function PinMarker({ m }: { m: MapMarker }) {
  const icon = useMemo(
    () => L.divIcon({ html: m.html, className: '', iconSize: m.size ?? PIN_SIZE, iconAnchor: m.anchor ?? PIN_ANCHOR }),
    [m.html, m.size, m.anchor],
  );
  const pos = useGlide(m.pos, m.glideMs ?? 700);
  return (
    <Marker
      position={pos}
      icon={icon}
      zIndexOffset={m.z ?? 0}
      title={m.label}
      alt={m.label}
      keyboard={!!m.onClick}
      interactive={!!m.onClick}
      eventHandlers={m.onClick ? { click: m.onClick, keypress: m.onClick } : undefined}
    />
  );
}

/** Light street map: Leaflet + CARTO Positron (or the OSM fallback). */
export function MapView({
  target,
  viewKey,
  markers,
  lines = [],
  insets = {},
  attribution = 'top-right',
  zoomControls = false,
  onMapClick,
}: {
  target: MapViewTarget;
  viewKey: string;
  markers: MapMarker[];
  lines?: MapLine[];
  insets?: MapInsets;
  attribution?: AttrPos;
  /** Show a stacked zoom in/out control below the attribution button (top-right). */
  zoomControls?: boolean;
  /** Tap anywhere on the map (used by the venue picker). */
  onMapClick?: (p: LatLng) => void;
}) {
  const initial = 'fit' in target ? target.fit[0] ?? ([1.35, 103.82] as LatLng) : target.center;
  return (
    <MapContainer
      center={initial}
      zoom={'zoom' in target ? target.zoom : 15}
      zoomControl={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer url={TILES.url} subdomains={TILES.subdomains} className={TILES.className} maxNativeZoom={TILES.maxZoom} maxZoom={20} />
      <ViewController target={target} viewKey={viewKey} insets={insets} />
      <Attribution position={attribution} />
      {zoomControls && <ZoomControls />}
      {onMapClick && <ClickCatcher onClick={onMapClick} />}
      {lines.map((l) => (
        <Polyline
          key={l.id}
          positions={l.points}
          pathOptions={{ color: l.color ?? '#5B3DF5', weight: l.weight ?? 5, opacity: l.opacity ?? 0.9, dashArray: l.dashed ? '2 9' : undefined, lineCap: 'round' }}
        />
      ))}
      {markers.map((m) => (
        <PinMarker key={m.id} m={m} />
      ))}
    </MapContainer>
  );
}
