"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

export type MarkerKind = "driver" | "pickup" | "destination" | "user";

export interface MapMarkerSpec {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  heading?: number;
  idle?: boolean;
  title?: string;
}

interface MapViewProps {
  center: LatLng;
  markers?: MapMarkerSpec[];
  route?: [number, number][] | null;
  onMapClick?: (point: LatLng) => void;
  className?: string;
  /** Changing fitKey re-fits the viewport to current markers + route. */
  fitKey?: string;
  zoom?: number;
}

interface LeafletBundle {
  map: import("leaflet").Map;
  L: typeof import("leaflet");
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function iconHtml(m: MapMarkerSpec): string {
  switch (m.kind) {
    case "driver":
      return `<div class="mk mk-driver ${m.idle ? "mk-driver-idle" : ""}" title="${m.title ?? "Driver"}"><div class="mk-driver-arrow" style="transform:rotate(${m.heading ?? 0}deg)">&#9650;</div></div>`;
    case "pickup":
      return `<div class="mk mk-pickup" title="${m.title ?? "Pickup"}"></div>`;
    case "destination":
      return `<div class="mk mk-dest" title="${m.title ?? "Destination"}"></div>`;
    case "user":
      return `<div class="mk mk-user" title="${m.title ?? "You"}"></div>`;
  }
}

/**
 * Leaflet map wrapper (OpenStreetMap-compatible tile providers).
 * Leaflet is loaded lazily inside an effect — SSR safe.
 */
export default function MapView({
  center,
  markers = [],
  route = null,
  onMapClick,
  className = "",
  fitKey,
  zoom = 14,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<LeafletBundle | null>(null);
  const markerRefs = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const routeRef = useRef<import("leaflet").Polyline | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const [ready, setReady] = useState(false);

  // Initialise once.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as { default?: typeof import("leaflet") }).default ?? mod) as typeof import("leaflet");
      if (disposed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, className: "maltown-tiles", maxZoom: 19 }).addTo(map);
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      bundleRef.current = { map, L };
      setReady(true);
      return () => {
        disposed = true;
        map.remove();
        bundleRef.current = null;
        markerRefs.current.clear();
      };
    })();
    return () => {
      disposed = true;
      bundleRef.current?.map.remove();
      bundleRef.current = null;
      markerRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile markers.
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!ready || !bundle) return;
    const { map, L } = bundle;
    const seen = new Set<string>();

    for (const spec of markers) {
      seen.add(spec.id);
      const existing = markerRefs.current.get(spec.id);
      const size = spec.kind === "driver" ? 34 : spec.kind === "destination" ? 16 : 18;
      const icon = L.divIcon({
        className: "",
        html: iconHtml(spec),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      if (existing) {
        existing.setLatLng([spec.lat, spec.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([spec.lat, spec.lng], { icon, keyboard: false }).addTo(map);
        markerRefs.current.set(spec.id, marker);
      }
    }
    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, ready]);

  // Route polyline.
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!ready || !bundle) return;
    const { map, L } = bundle;
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (route && route.length > 1) {
      routeRef.current = L.polyline(route, {
        color: "#3D9BFF",
        weight: 4,
        opacity: 0.85,
        dashArray: "1 10",
        lineCap: "round",
      }).addTo(map);
    }
  }, [route, ready]);

  // Fit viewport when requested.
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!ready || !bundle) return;
    const { map, L } = bundle;
    const points: [number, number][] = markers.map((m) => [m.lat, m.lng]);
    if (route) points.push(...route);
    if (points.length === 0) {
      map.setView([center.lat, center.lng], zoom);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  return <div ref={containerRef} className={`h-full w-full ${className}`} role="application" aria-label="Map" />;
}
