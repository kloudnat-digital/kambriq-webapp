'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { BRAND_TEAL, BRAND_TEAL_DARK } from '@/lib/brand-colors';
import { formatXAFCompact } from '@/lib/money';
import { useLandsSearchStore } from '@/store/lands-search.store';
import type { MockLand } from '@/data/mock-lands';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Approximate coordinates [lng, lat] for major Cameroon cities
const CITY_COORDS: Record<string, [number, number]> = {
  Douala: [9.7085, 4.05],
  Yaoundé: [11.5021, 3.848],
  Bafoussam: [10.42, 5.4741],
  Kribi: [9.9119, 2.9386],
  Garoua: [13.399, 9.3017],
  Maroua: [14.3158, 10.5918],
  Ngaoundéré: [13.584, 7.3247],
  Bamenda: [10.1597, 5.9597],
  Bertoua: [13.6838, 4.5774],
  Ebolowa: [11.1519, 2.9003],
};

// Define brand colors directly. Mapbox markers are manipulated imperatively
// using inline styles, bypassing standard Tailwind utilities.
const PRIMARY = BRAND_TEAL;
const PRIMARY_DARK = BRAND_TEAL_DARK;

type LandsMapProps = {
  lands: MockLand[];
  onLandClick?: (land: MockLand) => void;
};

export default function LandsMap({ lands, onLandClick }: LandsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { setActiveMarkerId } = useLandsSearchStore();

  // Init map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/monks--/cmmd7kp8k002u01schptz99sk',
      center: [11.0, 4.2], // Cameroon center
      zoom: 5.2,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers when lands change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    lands.forEach((land) => {
      const coords = CITY_COORDS[land.city];
      if (!coords) return;

      // Build marker element with inline styles (Tailwind classes don't work here)
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer; display:flex; flex-direction:column; align-items:center;';

      const pill = document.createElement('div');
      pill.textContent = formatXAFCompact(land.price);
      pill.style.cssText = `
        background-color: ${PRIMARY};
        color: white;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 9999px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        white-space: nowrap;
        transition: background-color 0.15s;
      `;
      pill.addEventListener('mouseenter', () => {
        pill.style.backgroundColor = PRIMARY_DARK;
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.backgroundColor = PRIMARY;
      });

      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 6px; height: 6px;
        background: ${PRIMARY};
        border-radius: 50%;
        margin-top: 2px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      `;

      el.appendChild(pill);
      el.appendChild(dot);

      el.addEventListener('click', () => {
        setActiveMarkerId(land.id);
        onLandClick?.(land);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [lands, onLandClick, setActiveMarkerId]);

  return <div ref={mapContainer} className="h-full w-full" />;
}
