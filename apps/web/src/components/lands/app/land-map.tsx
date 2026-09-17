'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { BRAND_TEAL } from '@/lib/brand-colors';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface LandMapProps {
  latitude: number;
  longitude: number;
  title: string;
}

export const LandMap = ({ latitude, longitude, title }: LandMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/monks--/cmmd7kp8k002u01schptz99sk',
      center: [longitude, latitude],
      zoom: 14,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    // Marker dot
    const el = document.createElement('div');
    // Built imperatively for Mapbox, so a Tailwind class cannot reach it.
    el.style.cssText = `
      width: 14px; height: 14px;
      background: ${BRAND_TEAL};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    `;

    new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(title))
      .addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, title]);

  return <div ref={containerRef} className="h-full w-full" />;
};
