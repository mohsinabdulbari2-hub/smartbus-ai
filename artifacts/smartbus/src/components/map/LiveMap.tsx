import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Bus, X, MapPin, Users, Clock, Navigation } from "lucide-react";
import { Link } from "wouter";
import { LiveBus, BusStop, BusRouteDetail } from "@workspace/api-client-react";

interface LiveMapProps {
  buses?: LiveBus[];
  stops?: BusStop[];
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];
const MAX_VISIBLE_BUSES = 100;

const CROWD_COLOR = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
} as const;

// ---------------- Marker factories (memoized via cache so we don't rebuild every tick) ----------------

const dotIconCache = new Map<string, L.DivIcon>();
function getDotIcon(color: string, selected: boolean): L.DivIcon {
  const key = `${color}|${selected ? 1 : 0}`;
  const cached = dotIconCache.get(key);
  if (cached) return cached;
  const size = selected ? 22 : 14;
  const ring = selected ? 3 : 2;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${ring}px solid #fff;box-shadow:0 0 ${selected ? 14 : 6}px ${color}aa,0 2px 6px rgba(0,0,0,0.5);"></div>`;
  const icon = L.divIcon({
    html,
    className: "bg-transparent border-0",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  dotIconCache.set(key, icon);
  return icon;
}

const arrowIconCache = new Map<string, L.DivIcon>();
function getArrowIcon(color: string, heading: number, selected: boolean): L.DivIcon {
  // Bucket heading to nearest 15° to keep cache small
  const bucket = Math.round(heading / 15) * 15;
  const key = `${color}|${bucket}|${selected ? 1 : 0}`;
  const cached = arrowIconCache.get(key);
  if (cached) return cached;
  const size = selected ? 26 : 16;
  const html = `
    <div style="transform:rotate(${bucket}deg);transform-origin:center;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(0 0 ${selected ? 8 : 3}px ${color}cc) drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        <path d="M12 2 L19 20 L12 16 L5 20 Z" fill="${color}" stroke="#fff" stroke-width="${selected ? 1.5 : 1}" stroke-linejoin="round"/>
      </svg>
    </div>`;
  const icon = L.divIcon({
    html,
    className: "bg-transparent border-0",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  arrowIconCache.set(key, icon);
  return icon;
}

// ---------------- Route detail cache (in-memory, persisted across renders) ----------------
// Stores the ORDERED stop list + the polyline shape so we can highlight
// current+next stops without re-fetching. Failed fetches are NOT cached as
// terminal — we use a short-lived backoff so transient errors can recover.

interface CachedRoute {
  shape: [number, number][] | null;
  stops: BusStop[];
}

const routeDetailCache = new Map<string, CachedRoute>();
const inflight = new Map<string, Promise<void>>();
const failureBackoff = new Map<string, number>(); // routeId -> earliest retry epoch ms
const FAILURE_BACKOFF_MS = 30_000;

function fetchRouteDetail(routeId: string): Promise<void> {
  if (routeDetailCache.has(routeId)) return Promise.resolve();
  const nextAllowed = failureBackoff.get(routeId) ?? 0;
  if (Date.now() < nextAllowed) return Promise.resolve();
  const existing = inflight.get(routeId);
  if (existing) return existing;
  const p = fetch(`/api/routes/${routeId}`)
    .then((res) => (res.ok ? (res.json() as Promise<BusRouteDetail>) : Promise.reject(res.status)))
    .then((r: BusRouteDetail) => {
      routeDetailCache.set(routeId, {
        shape: (r.shape as [number, number][] | null | undefined) ?? null,
        stops: r.stops ?? [],
      });
      failureBackoff.delete(routeId);
    })
    .catch(() => {
      // Don't poison the cache permanently — back off briefly and allow retry.
      failureBackoff.set(routeId, Date.now() + FAILURE_BACKOFF_MS);
    })
    .finally(() => {
      inflight.delete(routeId);
    });
  inflight.set(routeId, p);
  return p;
}

// ---------------- Viewport tracker (records visible bounds for culling) ----------------

function ViewportTracker({ onBounds }: { onBounds: (b: L.LatLngBounds) => void }) {
  const map = useMap();
  useEffect(() => {
    onBounds(map.getBounds());
  }, [map, onBounds]);
  useMapEvents({
    moveend: () => onBounds(map.getBounds()),
    zoomend: () => onBounds(map.getBounds()),
  });
  return null;
}

// ---------------- Click-to-deselect overlay ----------------

function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click: () => onClick(),
  });
  return null;
}

// ---------------- Helpers ----------------

function distanceSq(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

function etaFromDistance(meters: number, speedKmh: number): number | null {
  // If the bus is essentially stopped/crawling, we can't honestly estimate —
  // surface "—" in the UI rather than an over-optimistic number.
  if (speedKmh < 5) return null;
  const mps = speedKmh * (1000 / 3600);
  return Math.max(1, Math.ceil(meters / mps / 60));
}

// ===================================================================================
// Main component
// ===================================================================================

export function LiveMap({ buses = [], stops = [] }: LiveMapProps) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [shapeTick, setShapeTick] = useState(0); // bump to re-render once shape arrives

  // Keep the latest bus list in a ref so callbacks don't re-create when only
  // positions change.
  const busesById = useMemo(() => {
    const m = new Map<string, LiveBus>();
    for (const b of buses) m.set(b.id, b);
    return m;
  }, [buses]);

  const selectedBus = selectedBusId ? busesById.get(selectedBusId) ?? null : null;
  const selectedRouteId = selectedBus?.routeId ?? null;

  // Fetch + cache route detail (shape + ordered stops) for the selected route
  useEffect(() => {
    if (!selectedRouteId) return;
    if (routeDetailCache.has(selectedRouteId)) return;
    fetchRouteDetail(selectedRouteId).then(() => setShapeTick((t) => t + 1));
  }, [selectedRouteId]);

  const cached = selectedRouteId ? routeDetailCache.get(selectedRouteId) : undefined;
  const selectedShape = cached?.shape ?? null;
  // Touch shapeTick so the linter doesn't drop it; the value drives a re-render
  // when the route detail resolves asynchronously.
  void shapeTick;

  // ---- Viewport culling: filter buses to bounds, then cap to MAX_VISIBLE_BUSES ----
  const visibleBuses = useMemo<LiveBus[]>(() => {
    if (!bounds) return buses.slice(0, MAX_VISIBLE_BUSES);
    const inBounds = buses.filter((b) => bounds.contains([b.lat, b.lng]));
    if (inBounds.length <= MAX_VISIBLE_BUSES) return inBounds;
    // If too many, prefer those closest to the viewport center
    const c = bounds.getCenter();
    return inBounds
      .map((b) => ({ b, d: distanceSq(b.lat, b.lng, c.lat, c.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_VISIBLE_BUSES)
      .map((x) => x.b);
  }, [buses, bounds]);

  // ---- Stops shown only for the selected route, in route order ----
  // Prefer the cached ordered stops from route detail (correct sequence);
  // fall back to filtering the global stops list (unordered) while loading.
  const selectedRouteStops = useMemo<BusStop[]>(() => {
    if (!selectedRouteId) return [];
    if (cached?.stops?.length) return cached.stops;
    return stops.filter((s) => s.routeIds?.includes(selectedRouteId));
  }, [cached, stops, selectedRouteId]);

  // Derive the "current stop" id = the stop immediately before the next stop in
  // the route's ordered sequence. Falls back to null when ordering unavailable.
  const currentStopId = useMemo<string | null>(() => {
    if (!selectedBus || !cached?.stops?.length) return null;
    const idx = cached.stops.findIndex((s) => s.id === selectedBus.nextStopId);
    if (idx <= 0) return null;
    return cached.stops[idx - 1].id;
  }, [selectedBus, cached]);

  // Distance from selected bus to its next stop → ETA for the bottom panel
  const selectedEtaMin = useMemo(() => {
    if (!selectedBus) return null;
    return etaFromDistance(selectedBus.distanceToNextStop, selectedBus.speed);
  }, [selectedBus]);

  return (
    <div className="w-full h-full relative z-10 bg-[#0f172a]">
      <MapContainer
        center={BANGALORE_CENTER}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        preferCanvas={true}
      >
        {/* Dark, label-free tile = max contrast for routes/buses, min visual noise */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />

        <ViewportTracker onBounds={setBounds} />
        <MapClickHandler onClick={() => setSelectedBusId(null)} />

        {/* Selected route polyline — drawn first so markers sit on top */}
        {selectedShape && selectedShape.length >= 2 && (
          <>
            {/* Soft glow underlay */}
            <Polyline
              positions={selectedShape}
              pathOptions={{
                color: selectedBus?.routeColor || "#3b82f6",
                weight: 10,
                opacity: 0.18,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Crisp top line */}
            <Polyline
              positions={selectedShape}
              pathOptions={{
                color: selectedBus?.routeColor || "#3b82f6",
                weight: 4,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}

        {/* Stops only for selected route — current + next highlighted, others dim */}
        {selectedRouteStops.map((stop) => {
          const isNext = selectedBus?.nextStopId === stop.id;
          const isCurrent = currentStopId === stop.id;
          const highlight = isNext || isCurrent;
          return (
            <CircleMarker
              key={stop.id}
              center={[stop.lat, stop.lng]}
              radius={highlight ? 7 : 3.5}
              pathOptions={{
                color: isNext ? "#f59e0b" : isCurrent ? "#22c55e" : "#64748b",
                weight: highlight ? 3 : 1.25,
                fillColor: isNext ? "#fbbf24" : isCurrent ? "#4ade80" : "#1e293b",
                fillOpacity: highlight ? 1 : 0.6,
              }}
            />
          );
        })}

        {/* Buses — viewport culled & capped */}
        {visibleBuses.map((bus) => {
          const isSelected = bus.id === selectedBusId;
          const dim = selectedBusId !== null && !isSelected;
          const color = bus.routeColor || "#3b82f6";
          const icon =
            bus.speed > 5
              ? getArrowIcon(color, bus.heading || 0, isSelected)
              : getDotIcon(color, isSelected);
          return (
            <Marker
              key={bus.id}
              position={[bus.lat, bus.lng]}
              icon={icon}
              opacity={dim ? 0.35 : 1}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  setSelectedBusId(bus.id);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Top-right: count of visible buses (helps user understand the cull) */}
      {bounds && buses.length > visibleBuses.length && (
        <div className="absolute top-4 right-4 z-[500] bg-card/80 backdrop-blur-md border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg pointer-events-none">
          Showing {visibleBuses.length} of {buses.length}
        </div>
      )}

      {/* Floating bottom panel for selected bus */}
      {selectedBus && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[min(92vw,440px)] pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Top accent strip */}
            <div className="h-1.5 w-full" style={{ background: selectedBus.routeColor }} />

            <div className="p-4 flex flex-col gap-3">
              {/* Header row: route number + close */}
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center min-w-[58px] h-12 px-2.5 rounded-xl text-white font-display font-black text-lg leading-none shadow-md"
                  style={{ background: selectedBus.routeColor }}
                >
                  {selectedBus.routeNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Route
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {selectedBus.routeName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBusId(null)}
                  aria-label="Close panel"
                  className="w-8 h-8 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Three stats: ETA · crowd · next stop */}
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="ETA"
                  value={selectedEtaMin != null ? `${selectedEtaMin} min` : "Slow / stopped"}
                />
                <Stat
                  icon={<Users className="w-3.5 h-3.5" />}
                  label="Crowd"
                  value={selectedBus.crowdLevel}
                  valueColor={CROWD_COLOR[selectedBus.crowdLevel] ?? "#94a3b8"}
                />
                <Stat
                  icon={<Navigation className="w-3.5 h-3.5" />}
                  label="Speed"
                  value={`${Math.round(selectedBus.speed)} km/h`}
                />
              </div>

              {/* Next stop — emphasised */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/40">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Next stop
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {selectedBus.nextStop}
                  </div>
                </div>
                <Link
                  href={`/routes/${selectedBus.routeId}`}
                  className="text-xs font-bold text-primary hover:text-primary/80 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Bus className="w-3 h-3" />
                  Details
                </Link>
              </div>

              {selectedBus.isLastBus && (
                <div className="bg-orange-500/15 border border-orange-500/30 rounded-lg px-3 py-2 text-center text-xs font-bold text-orange-400 uppercase tracking-wider">
                  ⚠ Last bus tonight — board now
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-secondary/40 border border-border/30 rounded-lg px-2.5 py-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-bold truncate" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  );
}
