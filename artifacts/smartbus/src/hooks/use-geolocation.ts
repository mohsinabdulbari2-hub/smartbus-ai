import { useEffect, useRef, useState } from "react";

export type GeoStatus = "pending" | "granted" | "denied" | "unavailable" | "fallback";

export interface GeoState {
  lat: number;
  lng: number;
  status: GeoStatus;
  /** True if the coords come from the live device sensor (not last-known / city-center fallback). */
  isLive: boolean;
}

const STORAGE_KEY = "smartbus.lastKnownPosition";
// Bengaluru CBD — final fallback when no permission and no last-known location.
const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };

function readLastKnown(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat === "number" &&
      typeof parsed?.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeLastKnown(lat: number, lng: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * Request the user's current position via the browser Geolocation API.
 * Resolves immediately with a sensible fallback (last-known → Bengaluru
 * center) so callers never have to wait for permission to render the map.
 * The "isLive" flag flips to true once the real coordinates arrive.
 */
export function useGeolocation(): GeoState {
  const initialFallback = readLastKnown();
  const [state, setState] = useState<GeoState>(() => {
    if (initialFallback) {
      return { ...initialFallback, status: "fallback", isLive: false };
    }
    return { ...BENGALURU_CENTER, status: "pending", isLive: false };
  });
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unavailable" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        writeLastKnown(latitude, longitude);
        setState({ lat: latitude, lng: longitude, status: "granted", isLive: true });
      },
      () => {
        setState((s) => ({ ...s, status: "denied" }));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  return state;
}

/** Haversine distance in km. Used for client-side "any bus within 5km?" check. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
