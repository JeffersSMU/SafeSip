import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLng } from '../data/places';

export interface MapMarker {
  id: string;
  pos: LatLng;
  html: string;
  size?: [number, number];
  anchor?: [number, number];
  label: string;
  onClick?: () => void;
  z?: number;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  color?: string;
  weight?: number;
  dashed?: boolean;
  opacity?: number;
}

export type MapViewTarget = { center: LatLng; zoom: number } | { fit: LatLng[]; maxZoom?: number };

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Basemap (DESIGN §9 / A11): CARTO Positron, which now needs a free key passed as ?key= on the tile URL.
// VITE_MAP_TILE_URL (a full {z}/{x}/{y} template) overrides it; without either, OSM standard tiles are
// used, greyed via CSS, so the map never shows CARTO's "API KEY REQUIRED" watermark.
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();
const CUSTOM_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim();
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const TILES: { url: string; attribution: string; subdomains?: string; className?: string } = CUSTOM_URL
  ? { url: CUSTOM_URL, attribution: OSM_ATTR }
  : CARTO_KEY
    ? {
        url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`,
        attribution: `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
        subdomains: 'abcd',
      }
    : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR, className: 'ss-tiles' };

/** Avatar pin with status ring + battery badge (heuristic B1). */
export function pinHtml(o: { initials: string; color: string; ring: string; battery?: number; pulse?: boolean; car?: boolean }) {
  const cls = ['ss-pin', o.pulse ? 'ss-pin--pulse' : '', o.car ? 'ss-pin--car' : ''].join(' ');
  return `<div class="${cls}" style="--ring:${o.ring}"><div class="ss-pin__disc" style="background:${o.color}">${
    o.car ? '🚗' : esc(o.initials)
  }</div>${o.battery !== undefined ? `<span class="ss-pin__batt">${o.battery}%</span>` : ''}</div>`;
}

export const venueHtml = (name: string) => `<span class="ss-venue">${esc(name)}</span>`;
export const homeHtml = () => `<div class="ss-home" aria-hidden="true">⌂</div>`;

function ViewController({ target, viewKey }: { target: MapViewTarget; viewKey: string }) {
  const map = useMap();
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ('fit' in target) {
      if (target.fit.length === 0) return;
      const b = L.latLngBounds(target.fit.map((p) => L.latLng(p[0], p[1])));
      map.flyToBounds(b, { padding: [60, 60], maxZoom: target.maxZoom ?? 17, animate: !reduce, duration: 1.2 });
    } else {
      map.flyTo(target.center, target.zoom, { animate: !reduce, duration: 1.2 });
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

function PinMarker({ m }: { m: MapMarker }) {
  const icon = useMemo(
    () => L.divIcon({ html: m.html, className: '', iconSize: m.size ?? [44, 44], iconAnchor: m.anchor ?? [22, 22] }),
    [m.html, m.size, m.anchor],
  );
  return (
    <Marker
      position={m.pos}
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

/** Light street map: Leaflet + CARTO Positron tiles (no API key). */
export function MapView({
  target,
  viewKey,
  markers,
  lines = [],
  className,
}: {
  target: MapViewTarget;
  viewKey: string;
  markers: MapMarker[];
  lines?: MapLine[];
  className?: string;
}) {
  const initial = 'fit' in target ? target.fit[0] ?? ([1.35, 103.82] as LatLng) : target.center;
  return (
    <MapContainer
      center={initial}
      zoom={'zoom' in target ? target.zoom : 15}
      zoomControl={false}
      attributionControl
      className={className}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url={TILES.url}
        attribution={TILES.attribution}
        subdomains={TILES.subdomains ?? 'abc'}
        className={TILES.className}
        maxZoom={19}
      />
      <ViewController target={target} viewKey={viewKey} />
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
